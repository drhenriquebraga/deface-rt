/* =========================================================================
   Listas de apoio — prenomes, sobrenomes, lugares, saúde e operadoras

   PARA QUE SERVEM. O motor só troca um nome quando há gatilho no texto
   ("Paciente:", "Dr.", "Mora na"). Estas listas dão um segundo caminho: uma
   palavra que esteja aqui é reconhecida mesmo sem gatilho nenhum, que é como
   convênio e laboratório costumam aparecer — soltos, no meio da linha.

   O QUE ELAS NÃO SÃO. Não são cadastro nem base de identificação: são
   vocabulário. Estar fora da lista não protege ninguém, e é por isso que a
   tela mostra as suspeitas em vez de declarar o texto limpo. Uma lista de
   nomes nunca termina — a brasileira menos ainda.

   FALSO POSITIVO. Nome de lugar e sobrenome se confundem de propósito:
   "Santos" pode ser cidade ou sobrenome, e nos dois casos é identificador,
   então trocar está certo. O que foi evitado com cuidado é a colisão com
   vocabulário clínico: "Campos" sozinho não entra (campo de tratamento),
   "Barra" sozinho não entra, e por aí.
   ========================================================================= */
'use strict';

const _l = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

/* ---- prenomes -----------------------------------------------------------
   Cobre as gerações que hoje chegam ao ambulatório de radioterapia: nomes
   dos anos 1940-70 pesam mais que os da moda recente.                       */
const PRENOMES_EXTRA = _l(`
adalberto,adao,adelaide,adelia,adelina,ademar,ademir,adilson,adnilson,adolfo,adriana,adriano,
afonso,agenor,agnaldo,agostinho,aida,ailton,aires,alaide,alba,alberto,albino,alcides,alcina,
aldair,aldo,alessandra,alexandra,alfredo,alice,alicia,aline,almir,aloisio,altair,alvaro,alzira,
amalia,amanda,amaro,amauri,amelia,americo,ana,anabela,anailde,analia,anderson,andrea,andreia,
andresa,angelo,anisio,anselmo,antenor,antonia,antonieta,antonio,aparecido,ari,ariane,ariel,
aristides,arlete,arlindo,armando,arnaldo,aroldo,arthur,ary,assis,augusta,augusto,aurea,aurelio,
aurora,avanice,bartolomeu,benedita,benicio,benjamin,berenice,bernadete,bernardino,bete,betania,
bianca,boaventura,bonifacio,brenda,brenno,brigida,bruna,caetano,camilo,candida,candido,carla,
carlito,carmem,carmen,carolina,cassia,cassiano,catarina,cecilia,celeste,celia,celina,celio,celso,
cesar,cezar,cicero,cida,cintia,cirilo,ciro,clara,clarice,claudete,claudia,claudio,clea,clelia,
clemente,cleonice,cleusa,clovis,conceicao,constantino,cora,cordelia,cornelio,cristiane,cristiano,
cristina,dagmar,dagoberto,daiane,dalva,damiao,daniel,daniela,daniele,danilo,darci,darcy,dario,
davi,dayse,debora,deise,delcio,delfina,delia,delma,demetrio,denilson,denise,dercio,derli,diana,
diego,dilma,dinah,dione,dionisio,dirceu,dirce,divina,djalma,dolores,domingas,domingos,donizete,
dora,doralice,dorival,dorothy,dulce,dulcinea,durval,edeleusa,edenilson,edgar,edilene,edilson,
edinaldo,edir,edison,edite,edmar,edmilson,edmundo,edna,ednaldo,edson,eduarda,eduardo,edvaldo,
elaine,elba,eleonora,eliana,eliane,elias,elias,eliene,elisa,elisabete,elisangela,elisete,eliseu,
elizabeth,elizete,elmo,eloa,eloi,eloisa,elton,elvira,elza,emanuel,emerson,emilia,emiliano,emilio,
enio,enock,enzo,erasmo,erica,erick,erika,erivaldo,ernani,ernesto,esmeralda,esperanca,estela,
ester,esther,euclides,eugenia,eugenio,eunice,euripedes,eva,evandro,evaristo,evelyn,everaldo,
everton,ewerton,ezequiel,fabiana,fabiano,fabio,fabricio,fabiola,fatima,felicia,felipe,felisberto,
fernanda,fernando,filomena,flavia,flavio,florence,floriano,francisca,francisco,frederico,gabriel,
gabriela,gecilda,geisa,genesio,genival,geny,geovana,geralda,geraldo,gerson,gertrudes,gicelia,
gilberto,gilda,gildenice,gilmar,gilson,gilvan,gina,gioconda,giovana,giovanni,gisela,gisele,
gislene,gladys,gloria,gracia,graciela,gracinda,graziela,gregorio,guilherme,guiomar,gustavo,
hamilton,haroldo,heitor,helder,helena,helia,helio,heloisa,henrique,herbert,hercules,herminia,
hernani,hilda,hilton,homero,honorio,horacio,hortencia,hugo,humberto,ida,idalina,ieda,igor,ilda,
ildefonso,ilma,inacio,ines,ingrid,iolanda,ione,iracema,iraci,irene,irineu,iris,isabel,isabela,
isadora,isaias,isaura,ismael,israel,italo,ivan,ivana,ivanildo,ivete,ivo,ivone,jacinta,jacira,
jacob,jaime,jair,jairo,jamil,jandira,janete,janice,jaqueline,jeferson,jefferson,jenny,jeronimo,
jesus,joana,joao,joaquim,joel,joelma,jonas,jonathan,jordana,jorge,josafa,jose,josefa,joselia,
joselito,josiane,josias,josue,jovita,juarez,juca,judite,julia,juliana,juliano,julieta,julio,
juraci,jurandir,jussara,juvenal,karina,katia,kelly,laercio,laura,laurindo,lazaro,leandro,leda,
leila,leandra,lenice,leocadia,leonardo,leonel,leonice,leonor,leopoldo,leticia,lethicia,lia,
lidia,ligia,lilian,lindalva,lindomar,lino,lisandra,lisete,livia,lourdes,lourenco,lucas,lucia,
luciana,luciano,lucila,lucimar,lucineide,lucio,ludmila,luis,luisa,luiz,luiza,luzia,lygia,
madalena,magali,magda,magno,manoel,manuel,manuela,mara,marcela,marcelino,marcelo,marcia,marcio,
marco,marcondes,marcos,margareth,margarida,margarete,maria,mariana,mariano,maribel,maricelia,
marilda,marilene,marilia,marina,marinalva,marinete,mario,marisa,marise,maristela,marlene,marli,
marlon,marta,martha,martinho,mateus,matheus,mauricio,mauro,mavi,maximiano,melissa,mercedes,
messias,michel,michele,michelle,miguel,milena,milton,mirian,miriam,mirna,moacir,moises,monica,
morgana,murilo,myrian,nadia,nadir,nair,nancy,nara,natalia,natalina,natanael,nathalia,neide,
nelci,nelson,nestor,neusa,neuza,neuzeli,neyde,nicea,nicolas,nicolau,nilce,nilda,nilo,nilson,
nilton,nilza,nina,niva,nivaldo,noemi,noeli,norberto,norma,nubia,odair,odete,odila,olavo,olga,
olimpia,olinda,olivia,olivio,onofre,orlando,osmar,osorio,osvaldo,oswaldo,otacilio,otavio,otilia,
pamela,paloma,pascoal,patricia,paula,paulo,pedro,penha,percival,perpetua,pierre,plinio,poliana,
priscila,quiteria,rachel,rafael,rafaela,raimunda,raimundo,ramon,raquel,raul,regina,reginaldo,
regis,reinaldo,remi,renan,renata,renato,rene,ricardo,rita,roberta,roberto,robson,rodolfo,
rodrigo,rogerio,romario,romeu,romulo,ronaldo,roque,rosa,rosana,rosane,rosangela,rosaria,rosario,
roseli,rosely,rosemary,rosilda,rosilene,rosimeire,rubens,rui,ruth,ruy,sabrina,salete,salomao,
salvador,samara,samuel,sandra,sandro,sara,saulo,sebastiana,sebastiao,selma,semiramis,sergio,
sheila,shirley,sidney,silas,silmara,silvana,silvia,silvio,simone,sirlei,socorro,solange,sonia,
soraia,soraya,stela,stella,suely,sueli,sulamita,susana,sylvia,tadeu,tainara,taiza,tales,tamara,
tania,tarcisio,tatiana,tatiane,telma,teodoro,terezinha,teresinha,thais,thales,thelma,theo,
thiago,tiago,tomas,tomaz,ubirajara,ulisses,urbano,ursula,valdeci,valdecir,valdemar,valdenice,
valdir,valentim,valeria,valmir,valter,vanda,vandeci,vanessa,vania,vera,veronica,vicente,victor,
vilma,vinicius,violeta,virgilio,virginia,vitor,vitoria,vivaldo,viviane,wagner,waldemar,waldir,
wallace,walmir,walter,wanda,wanderley,washington,wellington,wenceslau,wesley,wilma,wilson,
wladimir,yara,yolanda,yvone,zelia,zenaide,zilda,zoraide,zuleica,zuleide,zulmira
`);

/* ---- sobrenomes ---------------------------------------------------------
   Uma sequência capitalizada que TERMINE num destes é nome de pessoa mesmo
   sem gatilho. É o que reconhece "MARISA FERNANDA ALVES HUIDOBRO POLEZE"
   pelo "ALVES" e "ROSELY PEREIRA COUTINHO ROSA" pelo "PEREIRA".             */
const SOBRENOMES = new Set(_l(`
abreu,affonso,aguiar,albuquerque,alencar,almeida,alves,amaral,amorim,anastacio,andrade,antunes,
aragao,araujo,arruda,assis,assuncao,avila,azevedo,bacelar,baptista,barbosa,barcelos,barreto,
barros,batista,bastos,bezerra,bittencourt,boaventura,bomfim,bonfim,borba,borges,botelho,braga,
brandao,bras,braz,brito,bueno,burger,caetano,camara,camargo,caminha,campelo,campos,candido,
cardoso,carneiro,carvalho,castro,cavalcante,cavalcanti,chaves,coelho,conceicao,cordeiro,correa,
correia,costa,coutinho,couto,cruz,cunha,dantas,delgado,dias,diniz,domingues,dorea,drummond,
duarte,dutra,esteves,farias,faria,fernandes,ferraz,ferreira,fidelis,figueiredo,filgueiras,
fonseca,fontes,fraga,franca,franco,freire,freitas,frota,furtado,gomes,goncalves,gouveia,
guedes,guerra,guimaraes,henriques,jesus,junqueira,lacerda,lago,leal,leao,leite,lemos,lemme,
lima,lins,lira,lisboa,lobo,lopes,loureiro,lourenco,lucena,luz,macedo,machado,maciel,madeira,
magalhaes,maia,malheiros,marinho,marques,martins,mascarenhas,matos,mattos,medeiros,meira,melo,
mello,mendes,mendonca,menezes,miranda,monteiro,montenegro,morais,moraes,moreira,moura,muniz,
nascimento,nery,neves,nobre,nogueira,nunes,oliveira,padilha,paiva,palma,passos,paula,pedrosa,
peixoto,penha,pereira,peres,pessoa,pimentel,pinheiro,pinho,pinto,pires,poleze,ponte,portela,
porto,prado,queiroz,quintanilha,ramalho,ramos,rangel,rezende,resende,ribeiro,rios,rocha,
rodrigues,rosa,sa,sales,salles,sampaio,sanches,sandim,santana,santiago,santos,saraiva,sarmento,
seixas,sermond,serra,severino,silva,silveira,simoes,siqueira,soares,sousa,souza,tavares,teixeira,
telles,teles,tenorio,toledo,torres,trindade,valadares,valente,vargas,vasconcelos,vaz,veiga,
veloso,ventura,viana,vianna,vieira,vilela,vasques,wanderley,xavier,zamae
`));

/* ---- lugares ------------------------------------------------------------
   Municípios de porte e a malha do Rio de Janeiro, que é onde estes
   aplicativos são usados. Só entram nomes que não colidem com vocabulário
   clínico: "Campos dos Goytacazes" entra, "Campos" sozinho não.             */
const LUGARES = new Set(_l(`
acari,agua santa,alcantara,alto da boa vista,anchieta,andarai,angra dos reis,anil,araruama,
bancarios,bangu,barra da tijuca,barra de guaratiba,barra do pirai,barra mansa,belford roxo,
benfica,bento ribeiro,bonsucesso,botafogo,braz de pina,brotas,cabo frio,cachambi,cacuia,
caju,camorim,campo dos afonsos,campo grande,campos dos goytacazes,cantagalo,carapebus,
cascadura,catete,catumbi,cavalcanti,coelho neto,colegio,complexo do alemao,copacabana,
cordovil,cosme velho,cosmos,costa barros,curicica,deodoro,del castilho,duque de caxias,
encantado,engenheiro leal,engenho da rainha,engenho de dentro,engenho novo,estacio,
flamengo,freguesia,gamboa,gardenia azul,gavea,gericino,gloria,grajau,grumari,guadalupe,
guapimirim,guaratiba,higienopolis,honorio gurgel,humaita,ilha de paqueta,ilha do governador,
inhauma,inhoaiba,ipanema,irajá,itaborai,itaguai,itaipava,itanhanga,jacarepagua,jacare,
jacarezinho,japeri,jardim america,jardim botanico,jardim carioca,jardim guanabara,jardim sulacap,
joa,lagoa,lapa,laranjeiras,leblon,leme,lins de vasconcelos,macae,madureira,mage,magalhaes bastos,
mangaratiba,manguinhos,maracana,marechal hermes,maricá,mesquita,meier,mendes,miguel pereira,
moneró,nilopolis,niteroi,nova friburgo,nova iguacu,olaria,osvaldo cruz,oswaldo cruz,paciencia,
padre miguel,paraty,parada de lucas,pavuna,pechincha,pedra de guaratiba,penha circular,
petropolis,piedade,pilares,pitangueiras,portuguesa,praca da bandeira,praca seca,praia da bandeira,
quintino,queimados,quissama,ramos,realengo,recreio dos bandeirantes,resende,ribeira,riachuelo,
rio comprido,rio das ostras,rio das pedras,rocha miranda,rocinha,sampaio,santa cruz,santa teresa,
santissimo,saquarema,sao conrado,sao cristovao,sao francisco xavier,sao goncalo,sao joao de meriti,
saude,senador camara,senador vasconcelos,sepetiba,sulacap,tanque,taquara,tau,teresopolis,
tijuca,todos os santos,tomas coelho,turiacu,urca,vargem grande,vargem pequena,vasco da gama,
vaz lobo,vicente de carvalho,vidigal,vigario geral,vila da penha,vila isabel,vila kosmos,
vila militar,vila valqueire,volta redonda,vista alegre,zumbi,
aracaju,belem,belo horizonte,boa vista,brasilia,campina grande,campinas,cuiaba,curitiba,
feira de santana,florianopolis,fortaleza,goiania,guarulhos,joao pessoa,joinville,juiz de fora,
londrina,maceio,manaus,natal,osasco,palmas,porto alegre,porto velho,recife,ribeirao preto,
rio branco,salvador,santo andre,sao bernardo do campo,sao jose dos campos,sao luis,sao paulo,
sorocaba,teresina,uberlandia,vitoria da conquista,juazeiro do norte,petrolina,caxias do sul,
sao francisco do sul,itajai,blumenau,criciuma,chapeco,maringa,ponta grossa,cascavel,foz do iguacu
`));

/* ---- instituições de saúde ---------------------------------------------- */
const SAUDE = new Set(_l(`
albert einstein,albert sabin,americas,badim,balbino,bangu,barra dor,barra d'or,beneficencia portuguesa,
bonsucesso,cardio pulmonar,casa de saude sao jose,cdpi,central do exercito,clementino fraga filho,
copa dor,copa d'or,copa star,cardiotrauma,delboni,diagnosticos da america,fleury,felippe mattoso,
gaffree e guinle,getulio vargas,glorinha,hospital casa,inca,into,ipanema plus,israelita,
labs a mais,lagoa,lamina,lourenco jorge,marcilio dias,micro imagem,microimagem,miguel couto,
multi imagem,niteroi dor,norte dor,oeste dor,pardini,pedro ernesto,pro cardiaco,quinta dor,
quinta d'or,richet,rio dor,rocha faria,salgado filho,samaritano,santa lucia,santa luzia,
santa marta,santa teresa,sao lucas,sao vicente,sergio franco,servidores do estado,silvestre,
sao francisco na providencia,souza aguiar,unimed rio,vitoria,bronstein,bioclinico,alta excelencia,
diagnostico da america,cetrim,cdb,mednuclear,medimagem,pasteur,sabin,exame,hermes pardini,
oncoclinicas,americas oncologia,inrad,instituto nacional de cancer,hospital do cancer
`));

/* ---- operadoras de saúde ------------------------------------------------ */
const OPERADORAS = _l(`
medsenior,med senior,amil,amil dental,bradesco saude,bradesco,sulamerica,sul america,unimed,
unimed rio,unimed nacional,unimed ferj,golden cross,real grandeza,assim saude,assim,cassi,geap,
petrobras,ampla,postal saude,notredame intermedica,notredame,intermedica,hapvida,porto seguro,
omint,care plus,allianz,sompo,plena saude,saude caixa,fusex,fusma,funcef,cabergs,caberj,assefaz,
ameplan,prevent senior,mediservice,gama saude,life empresarial,unafisco,economus,capesesp,
saude petrobras,samp,promed,biovida,trasmontano,santa casa saude,sao francisco saude,
central nacional unimed,seguros unimed,qualicorp,mais saude,vitallis,unihosp,plan assiste,
cabesp,camed,casembrapa,fiosaude,gs saude,ipsemg,ipe saude,iamspe,saude bradesco,tempo saude
`);

/* ---- fusão com o que 20_padroes.js já trazia ---------------------------- */
for (const n of PRENOMES_EXTRA) PRENOMES.add(n);
for (const o of OPERADORAS) if (CONVENIOS.indexOf(o) < 0) CONVENIOS.push(o);
