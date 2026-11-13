"""Converte somente o asset CC0 MakeHuman em distância assinada para o fantoma.

Uso: python build/preparar_anatomia.py --origem caminho/base.obj
     python build/preparar_anatomia.py --baixar

Dependências de preparação: Python, NumPy, SciPy (não usadas no aplicativo).
Nenhum código do MakeHuman é importado ou executado. A malha é dado gráfico.
"""
from __future__ import annotations
import argparse
import base64
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import numpy as np
from scipy.ndimage import distance_transform_edt

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parents[1]
REV = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
SOURCE_URL = f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{REV}/makehuman/data/3dobjs/base.obj'
SOURCE_SHA = '8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c'
DIMS = (192, 224, 256)
SCALE = 88.0
OFFSET_A = 0.64455
OFFSET_S = 7.09565
CUT_SOURCE = 5.71
CUT_S = (CUT_SOURCE - OFFSET_S) * SCALE
EYES = ((-27.082, 52.8704, 16.588), (27.082, 52.8704, 16.588))
EYE_R = 11.792


def read_mesh(source):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA:
        raise ValueError('O SHA-256 da malha de origem não corresponde à revisão fixada.')
    vertices, faces, group = [], [], ''
    for line in raw.decode('utf-8').splitlines():
        if line.startswith('v '):
            vertices.append([float(x) for x in line.split()[1:]])
        elif line.startswith('g '):
            group = line[2:]
        elif line.startswith('f ') and group == 'body':
            faces.append([int(x.split('/')[0])-1 for x in line.split()[1:]])
    vertices = np.asarray(vertices, dtype=np.float64)
    # Guardamos uma faixa abaixo do corte para subdividir sem deformar o pescoço.
    faces = [f for f in faces if max(vertices[f, 1]) > 5.4]
    used = sorted({i for f in faces for i in f})
    remap = {old: new for new, old in enumerate(used)}
    return vertices[used], [[remap[i] for i in f] for f in faces]


def subdivide(vertices, faces):
    """Uma iteração Catmull-Clark própria; bordas usam a regra 3/4, 1/8, 1/8."""
    face_points = np.array([vertices[f].mean(axis=0) for f in faces])
    edges = {}
    adjacent_faces = [[] for _ in vertices]
    adjacent_edges = [[] for _ in vertices]
    for fi, face in enumerate(faces):
        for i in face:
            adjacent_faces[i].append(fi)
        for j, a in enumerate(face):
            b = face[(j+1) % len(face)]
            edge = tuple(sorted((a, b)))
            if edge not in edges:
                edges[edge] = []
                adjacent_edges[a].append(edge)
                adjacent_edges[b].append(edge)
            edges[edge].append(fi)
    new_vertices = np.empty_like(vertices)
    for i, original in enumerate(vertices):
        boundary = [e for e in adjacent_edges[i] if len(edges[e]) == 1]
        if boundary:
            others = [vertices[e[1] if e[0] == i else e[0]] for e in boundary]
            new_vertices[i] = .75 * original + .25 * np.mean(others, axis=0)
        else:
            n = len(adjacent_faces[i])
            f = face_points[adjacent_faces[i]].mean(axis=0)
            r = np.mean([(vertices[a]+vertices[b])/2 for a, b in adjacent_edges[i]], axis=0)
            new_vertices[i] = (f + 2*r + (n-3)*original) / n
    edge_idx = {}
    edge_points = []
    for edge, adjoining in edges.items():
        edge_idx[edge] = len(vertices) + len(edge_points)
        a, b = edge
        if len(adjoining) == 2:
            point = (vertices[a] + vertices[b] + face_points[adjoining].sum(axis=0))/4
        else:
            point = (vertices[a] + vertices[b])/2
        edge_points.append(point)
    offset_faces = len(vertices) + len(edge_points)
    quads = []
    for fi, face in enumerate(faces):
        for j, a in enumerate(face):
            b = face[(j+1) % len(face)]
            previous = face[(j-1) % len(face)]
            quads.append([a, edge_idx[tuple(sorted((a,b)))], offset_faces+fi,
                          edge_idx[tuple(sorted((previous,a)))]])
    return np.concatenate((new_vertices, np.array(edge_points), face_points)), quads


def to_las(vertices):
    return np.column_stack((vertices[:,0]*SCALE,
                            (vertices[:,2]-OFFSET_A)*SCALE,
                            (vertices[:,1]-OFFSET_S)*SCALE))


def voxelize(vertices, faces):
    """Raios anterior/posterior; duas interseções delimitam o interior fechado."""
    nx, ny, nz = DIMS
    cx, cy, cz = [(n-1)/2 for n in DIMS]
    triangles = np.asarray([[f[0], f[t], f[t+1]] for f in faces for t in range(1,len(f)-1)])
    hits = [[] for _ in range(nx*nz)]
    for tri in vertices[triangles]:
        projected = tri[:, (0,2)] + (cx,cz)
        low = np.maximum(np.ceil(projected.min(axis=0)).astype(int), (0,0))
        high = np.minimum(np.floor(projected.max(axis=0)).astype(int), (nx-1,nz-1))
        if np.any(low > high):
            continue
        x0,z0 = projected[0]; x1,z1 = projected[1]; x2,z2 = projected[2]
        denominator = (z1-z2)*(x0-x2)+(x2-x1)*(z0-z2)
        if abs(denominator) < 1e-10:
            continue
        xx, zz = np.meshgrid(np.arange(low[0],high[0]+1), np.arange(low[1],high[1]+1))
        b0 = ((z1-z2)*(xx-x2)+(x2-x1)*(zz-z2))/denominator
        b1 = ((z2-z0)*(xx-x2)+(x0-x2)*(zz-z2))/denominator
        b2 = 1-b0-b1
        keep = (b0>=-1e-9)&(b1>=-1e-9)&(b2>=-1e-9)
        anterior = b0*tri[0,1]+b1*tri[1,1]+b2*tri[2,1]
        for i,k,a in zip(xx[keep],zz[keep],anterior[keep]):
            hits[int(i+k*nx)].append(float(a))
    inside = np.zeros((nz,ny,nx),dtype=bool)
    odd = 0
    for k in range(nz):
        if k-cz < CUT_S:
            continue
        for i in range(nx):
            positions = sorted(hits[i+k*nx])
            unique = [a for p,a in enumerate(positions) if p==0 or a-positions[p-1]>1e-5]
            if len(unique)%2:
                odd += 1
                continue
            for p in range(0,len(unique),2):
                lo = max(0,int(np.ceil(cy-unique[p+1])))
                hi = min(ny-1,int(np.floor(cy-unique[p])))
                inside[k,lo:hi+1,i] = True
    if odd:
        raise ValueError(f'{odd} raios de paridade ímpar; geometria não pode ser publicada.')
    l = np.arange(nx)-cx
    a = cy-np.arange(ny)
    s = np.arange(nz)-cz
    for eye_l,eye_a,eye_s in EYES:
        inside |= ((l[None,None,:]-eye_l)**2 + (a[None,:,None]-eye_a)**2 +
                   (s[:,None,None]-eye_s)**2 <= EYE_R**2)
    return inside, triangles


def closest_squared(points, triangle):
    """Distância ponto-triângulo via projeção no plano ou segmento mais próximo."""
    a,b,c = triangle
    ab,ac = b-a,c-a
    normal = np.cross(ab,ac)
    norm2 = np.dot(normal,normal)
    if norm2 < 1e-14:
        return np.full(len(points), np.inf)
    ap = points-a
    dot = ap@normal
    projected = ap - (dot/norm2)[:,None]*normal
    d00,d01,d11 = np.dot(ab,ab),np.dot(ab,ac),np.dot(ac,ac)
    den = d00*d11-d01*d01
    beta = (d11*(projected@ab)-d01*(projected@ac))/den
    gamma = (d00*(projected@ac)-d01*(projected@ab))/den
    within = (beta>=0)&(gamma>=0)&(beta+gamma<=1)
    result = np.full(len(points),np.inf)
    for e0,e1 in ((a,b),(b,c),(c,a)):
        segment=e1-e0
        t=np.clip(((points-e0)@segment)/np.dot(segment,segment),0,1)
        result=np.minimum(result,np.sum((points-e0-t[:,None]*segment)**2,axis=1))
    result[within] = dot[within]**2/norm2
    return result


def refine_surface(signed, inside, vertices, triangles):
    """Mede a distância real à malha perto da pele; evita degraus de voxel de1mm."""
    nx,ny,nz=DIMS
    cx,cy,cz=[(n-1)/2 for n in DIMS]
    best=np.full(signed.shape,9.0,dtype=np.float32)
    radius=1.6
    for count,tri in enumerate(vertices[triangles]):
        voxel = np.column_stack((tri[:,0]+cx,cy-tri[:,1],tri[:,2]+cz))
        low=np.maximum(np.ceil(voxel.min(axis=0)-radius).astype(int),(0,0,0))
        high=np.minimum(np.floor(voxel.max(axis=0)+radius).astype(int),(nx-1,ny-1,nz-1))
        if np.any(low>high): continue
        z,y,x=np.meshgrid(np.arange(low[2],high[2]+1),np.arange(low[1],high[1]+1),
                          np.arange(low[0],high[0]+1),indexing='ij')
        points=np.column_stack((x.ravel()-cx,cy-y.ravel(),z.ravel()-cz))
        ds=closest_squared(points,tri).reshape(x.shape)
        section=np.s_[low[2]:high[2]+1,low[1]:high[1]+1,low[0]:high[0]+1]
        np.minimum(best[section],ds,out=best[section])
        if count and count%30000==0: print('Distância à superfície:',count,'triângulos',flush=True)
    valid=best<radius**2
    signed[valid]=np.sqrt(best[valid])*np.where(inside[valid],1,-1)
    # União dos globos. A distância negativa indica exterior do corpo e do olho.
    l=np.arange(nx)-cx; a=cy-np.arange(ny); s=np.arange(nz)-cz
    for eye_l,eye_a,eye_s in EYES:
        eye=EYE_R-np.sqrt((l[None,None,:]-eye_l)**2+(a[None,:,None]-eye_a)**2+
                          (s[:,None,None]-eye_s)**2)
        signed=np.maximum(signed,eye)
    # Interseção com um plano corta e fecha o pescoço em uma única superfície.
    signed=np.minimum(signed,s[:,None,None]-CUT_S)
    return signed


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origem',type=Path)
    parser.add_argument('--baixar',action='store_true')
    options=parser.parse_args()
    source=options.origem or ROOT/'.publicacao/anatomia/base.obj'
    if options.baixar:
        source.parent.mkdir(parents=True,exist_ok=True)
        subprocess.run(['curl','--fail','--location','--silent','--show-error',SOURCE_URL,
                        '--output',str(source)],check=True)
    vertices,faces=read_mesh(source)
    print('Recorte de cabeça e pescoço:',len(vertices),'vértices',len(faces),'faces',flush=True)
    for iteration in range(2):
        vertices,faces=subdivide(vertices,faces)
        print('Catmull-Clark',iteration+1,':',len(vertices),'vértices',len(faces),'quads',flush=True)
    vertices=to_las(vertices)
    inside,triangles=voxelize(vertices,faces)
    print('Volume preenchido:',int(inside.sum()),'voxels; sem raios ímpares',flush=True)
    signed=np.where(inside,distance_transform_edt(inside)-.5,-distance_transform_edt(~inside)+.5).astype(np.float32)
    signed=refine_surface(signed,inside,vertices,triangles)
    encoded=np.rint(np.clip(signed,-8,8)/.25).astype(np.int8).tobytes(order='C')
    compressed=gzip.compress(encoded,compresslevel=9,mtime=0)
    # O campo OS do cabeçalho gzip é fixado para saída idêntica entre plataformas.
    compressed=compressed[:9]+bytes([255])+compressed[10:]
    content={
        'dimensoes':list(DIMS),'espaco':[1,1,1],
        'formato':'int8-gzip-base64; x rápido, y posterior, z superior; positivo dentro',
        'escalaDistancia':.25,
        'distanciaBase64':base64.b64encode(compressed).decode('ascii'),
        'origem':{'nome':'MakeHuman hm08, cabeça e pescoço sintéticos','licenca':'CC0-1.0',
                  'revisao':REV,'url':SOURCE_URL,'sha256Origem':SOURCE_SHA,
                  'sha256Distancia':hashlib.sha256(encoded).hexdigest()},
        'referencias':{'nariz':[0,91.1812,-16.4252],'olhos':[list(e) for e in EYES],
                       'raioOlho':EYE_R,'queixo':[0,51.5724,-82.7332],
                       'topo':122.8172,'cortePescoco':CUT_S}
    }
    output=ROOT/'src/js/74_anatomia.js'
    output.write_text('/* Superfície humana sintética MakeHuman hm08 (CC0-1.0).\n'
                      '   Dado gráfico derivado; nenhuma imagem ou exame de paciente.\n'
                      '   Reproduzir: python build/preparar_anatomia.py --baixar\n'
                      '   Não editar o payload gerado. Proveniência em exemplos/anatomia/. */\n'
                      "'use strict';\nconst ANATOMIA_SINTETICA = "+
                      json.dumps(content,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    provenance={**content['origem'],'dimensoes':list(DIMS),'espaco_mm':[1,1,1],
                'transformacao':{'escala_mm_por_unidade':SCALE,'offset_anterior_source_z':OFFSET_A,
                                 'offset_superior_source_y':OFFSET_S,'corte_source_y':CUT_SOURCE},
                'processo':['Somente grupo body do OBJ, recortado na cabeça e pescoço',
                            'Duas subdivisões Catmull-Clark implementadas neste projeto',
                            'Preenchimento por paridade de raios e globos oculares sintéticos',
                            'Distância ao triângulo da pele e plano de fechamento do pescoço',
                            'Campo Int8, positivo dentro, passo0.25mm, clamp±8mm, gzip determinístico'],
                'vertices_subdivididos':len(vertices),'triangulos':len(triangles),
                'voxels_internos':int(inside.sum()),'bytes_sem_compressao':len(encoded),
                'bytes_gzip':len(compressed),'referencias_mm_las':content['referencias'],
                'observacao':'Superfície de personagem 3D. Não contém anatomia interna nem dados clínicos; os tecidos são simulados separadamente.'}
    doc=ROOT/'exemplos/anatomia'
    doc.mkdir(parents=True,exist_ok=True)
    (doc/'PROVENIENCIA.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Asset:',output,'gzip',len(compressed),'SHA256 campo',provenance['sha256Distancia'],flush=True)


if __name__=='__main__': main()
