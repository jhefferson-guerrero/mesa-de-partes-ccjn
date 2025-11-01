const ubigeo = {
    data: {
        "Amazonas":{
            "Chachapoyas":["Asunción","Balsas","Chachapoyas","Cheto","Chiliquín","Chuquibamba","Granada","Huancas","La Jalca","Levanto","Magdalena","Mariscal Castilla","Molinopampa","San Francisco de Daguas","San Juan de la Frontera","San Miguel de Corosha","San Nicolás","Sonche","Soloco","Quinjalca"],
            "Bagua":["Bagua","Aramango","Copallín","El Parco","Imaza","La Peca"],
            "Bongará":["Chisquilla","Churuja","Corosha","Cuispes","Florida","Jazan","Jumbilla","Recta","San Carlos","Shipasbamba","Valera","Yamblasbamba"],
            "Condorcanqui":["El Cenepa","Nieva","Río Santiago"],
            "Luya":["Camporredondo","Cocabamba","Colcamar","Conila","Inguilpata","Lámud","Longuita","Lonya Chico","Luya","Luya Viejo","María","Ocalli","Ocumal","Pisuquía","Providencia","San Cristóbal","San Francisco del Yeso","San Jerónimo","San Juan de Lopecancha","Santa Catalina","Santo Tomás","Tingo","Trita"],
            "Rodríguez de Mendoza":["Chirimoto","Cochamal","Huambo","Limabamba","Longar","Mariscal Benavides","Milpuc","Omia","San Nicolás","Santa Rosa","Totora","Vista Alegre"],
            "Utcubamba":["Bagua Grande","Cajaruro","Cumba","El Milagro","Jamalca","Lonya Grande","Yamón"]
        },
        "Áncash":{
            "Aija":["Aija","Coris","Huacllán","La Merced","Succha"],
            "Antonio Raimondi":["Aczo","Chaccho","Chingas","Llamellín","Mirgas","San Juan de Rontoy"],
            "Asunción":["Acochaca","Chacas"],
            "Bolognesi":["Abelardo Pardo","Antonio Raymondi","Aquia","Cajacay","Canis","Chiquián","Cólquioc","Huallanca","Huasta","Huayllacayán","La Primavera","Mangas","Pacllón","San Miguel","Ticllos"],
            "Carhuaz":["Acopampa","Amashca","Anta","Ataquero","Carhuaz","Marcará","Pariahuanca","San Miguel de Aco","Shilla","Tinco","Yungar"],
            "Carlos Fermín Fitzcarrald":["San Luis","San Nicolás","Yauya"],
            "Casma":["Casma","Buena Vista Alta","Comandante Noel","Yaután"],
            "Corongo":["Aco","Bambas","Corongo","Cusca","La Pampa","Yánac","Yupán"],
            "Huaraz":["Cochabamba","Colcabamba","Huanchay","Huaraz","Independencia","Jangas","La Libertad","Olleros","Pampas Grande","Pariacoto","Pira","Tarica"],
            "Huari":["Anra","Cajay","Chavín de Huántar","Huacachi","Huacchis","Huachis","Huántar","Huari","Masin","Paucas","Pontó","Rahuapampa","Rapayán","San Marcos","San Pedro de Chaná","Uco"],
            "Huarmey":["Cochapeti","Culebras","Huarmey","Huayan","Malvas"],
            "Huaylas":["Caraz","Huallanca","Huata","Huaylas","Mato","Pamparomás","Pueblo Libre","Santa Cruz","Santo Toribio","Yuracmarca"],
            "Mariscal Luzuriaga":["Casca","Eleazar Guzmán Barrón","Fidel OIivas Escudero","Llama","Llumpa","Lucma","Musga","Piscobamba"],
            "Ocros":["Acas","Cajamarquilla","Carhuapampa","Cochas","Congas","Llipa","Ocros","San Cristóbal de Raján","San Pedro","Santiago de Chilcas"],
            "Pallasca":["Bolognesi","Cabana","Conchucos","Huacaschuque","Huandoval","Lacabamba","Llapo","Pallasca","Pampas","Santa Rosa","Tauca"],
            "Pomabamba":["Huayllán","Parobamba","Pomabamba","Quinuabamba"],
            "Recuay":["Cátac","Cotaparaco","Huayllapampa","Llacllín","Marca","Pampas Chico","Pararín","Recuay","Tapacocha","Ticapampa"],
            "Santa":["Chimbote","Cáceres del Perú","Coishco","Macate","Moro","Nepeña","Nuevo Chimbote","Samanco","Santa"],
            "Sihuas":["Acobamba","Alfonso Ugarte","Cashapampa","Chingalpo","Huayllabamba","Quiches","Ragash","San Juan","Sicsibamba","Sihuas"],
            "Yungay":["Cascapara","Mancos","Matacoto","Quillo","Ranrahírca","Shupluy","Yanama","Yungay"],
        },
        "Apurimac":{
            "Abancay":["Abancay","Chacoche","Circa","Curahuasi","Huanipaca","Lambrama","Pichirhua","San Pedro de Cachora","Tamburco"],
            "Andahuaylas":["Andahuaylas","Andarapa","Chiara","Huancarama","Huancaray","Huayana","José María Arguedas","Kaquiabamba","Kishuara","Pacobamba","Pacucha","Pampachiri","Pomacocha","San Antonio de Cachi","San Jerónimo","San Miguel de Chaccrapampa","Santa María de Chicmo","Talavera de la Reyna","Tumay Huaraca","Turpo"],
            "Antabamba":["Antabamba","El Oro","Huaquirca","Juan Espinoza Medrano","Oropesa","Pachaconas","Sabaino"],
            "Aymaraes":["Capaya","Caraybamba","Chalhuanca","Chapimarca","Colcabamba","Cotaruse","Ihuayllo","Justo Apu Sahuaraura","Lucre","Pocohuanca","San Juan de Chacña","Sañayca","Soraya","Tapairihua","Tintay","Toraya","Yanaca"],
            "Chincheros":["Anccohuayllo","Chincheros","Cocharcas","El Porvenir","Huaccana","Los Chankas","Ocobamba","Ongoy","Ranracancha","Rocchac","Uranmarca"],
            "Cotabambas":["Chalhuahuacho","Cotabambas","Coyllurqui","Haquira","Mara","Tambobamba"],
            "Grau":["Chuquibambilla","Curasco","Curpahuasi","Huayllati","Mamara","Mariscal Gamarra","Micaela Bastidas","Pataypampa","Progreso","San Antonio","Santa Rosa","Turpay","Vilcabamba","Virundo"]
        },
        "Arequipa":{
            "Arequipa":["Alto Selva Alegre","Arequipa","Cayma","Cerro Colorado","Characato","Chiguata","Jacobo Hunter","José Luis Bustamante y Rivero","La Joya","Mariano Melgar","Miraflores","Mollebaya","Paucarpata","Pocsi","Polobaya","Quequeña","Sabandía","Sachaca","San Juan de Siguas","San Juan de Tarucani","Santa Isabel de Siguas","Santa Rita de Siguas","Socabaya","Tiabaya","Uchumayo","Vitor","Yanahuara","Yarabamba","Yura"],
            "Camaná":["Camaná","José María Quimper","Mariano Nicolás Valcarcel","Mariscal Cáceres","Nicolás de Piérola","Ocoña","Quilca","Samuel Pastor"],
            "Caravelí":["Acarí","Atico","Atiquipa","Bella Unión","Cahuacho","Caravelí","Chala","Cháparra","Huanuhuanu","Jaquí","Lomas","Quicacha","Yauca"],
            "Castilla":["Aplao","Andahua","Ayo","Chachas","Chilcaymarca","Choco","Huancarqui","Machaguay","Orcopampa","Pampacolca","Tipán","Uñón","Uraca","Viraco"],
            "Caylloma":["Achoma","Cabanaconde","Callalli","Caylloma","Chivay","Coporaque","Huambo","Huanca","Ichupampa","Lari","Lluta","Maca","Madrigal","Majes","San Antonio de Chuca","Sibayo","Tapay","Tisco","Tuti","Yanque"],
            "Condesuyos":["Andaray","Cayarani","Chichas","Chuquibamba","Iray","Río Grande","Salamanca","Yanaquihua"],
            "Islay":["Cocachacra","Deán Valdivia","Islay","Mejía","Mollendo","Punta de Bombón"],
            "La Unión":["Alca","Charcana","Cotahuasi","Huaynacotas","Pampamarca","Puyca","Quechualla","Sayla","Tauría","Tomepampa","Toro"]
        },
        "Ayacucho":{
            "Cangallo":["Cangallo","Chuschi","Los Morochucos","María Parado de Bellido","Paras","Totos  "],
            "Huamanga":["Acocro","Acos Vinchos","Andrés Avelino Cáceres Dorregaray","Ayacucho","Carmen Alto","Chiara","Jesús Nazareno","Ocros","Pacaycasa","Quinua","San José de Ticllas","San Juan Bautista","Santiago de Pischa","Socos","Tambillo","Vinchos"],
            "Huanca Sancos":["Carapo","Sacsamarca","Sancos","Santiago de Lucanamarca"],
            "Huanta":["Ayahuanco","Canayre","Chaca","Huamanguilla","Huanta","Iguaín","Llochegua","Luricocha","Pucacolpa","Santillana","Sivia","Uchuraccay"],
            "La Mar":["Anchihuay","Anco","Ayna","Chilcas","Chungui","Luis Carranza","Oronccoy","Samugari","San Miguel","Santa Rosa","Tambo"],
            "Lucanas":["Aucaras","Cabana Sur","Carmen Salcedo","Chaviña","Chipao","Huacuas","Laramate","Leoncio Prado","Llauta","Lucanas","Ocaña","Otoca","Puquio","Saisa","San Cristóbal","San Juan","San Pedro","San Pedro de Palco","Sancos","Santa Ana de Huaycahuacho","Santa Lucía"],
            "Parinacochas":["Coracora","Chumpi","Coronel Castañeda","Pacapausa","Pullo","Puyusca","San Francisco de Ravacayco","Upahuacho"],
            "Páucar del Sara Sara":["Colta","Corculla","Lampa","Marcabamba","Oyolo","Pararca","Pauza","San Javier de Alpabamba","San José de Ushua","Sara Sara"],
            "Sucre":["Belén","Chalcos","Chilcayoc","Huacaña","Morcolla","Paico","Querobamba","San Pedro de Larcay","San Salvador de Quije","Santiago de Paucaray","Soras"],
            "Víctor Fajardo":["Alcamenca","Apongo","Asquipata","Canaria","Cayara","Colca","Huamanquiquia","Huancapi","Huancaraylla","Huaya","Sarhua","Vilcanchos"],
            "Vilcashuamán":["Accomarca","Carhuanca","Concepción","Huambalpa","Independencia","Saurama","Vilcashuamán","Vischongo"]
        },
        "Cajamarca":{
            "Cajabamba":["Cachachi","Cajabamba","Condebamba","Sitacocha"],
            "Cajamarca":["Asunción","Cajamarca","Chetilla","Cospán","Jesús","La Encañada","Llacanora","Los Baños del Inca","Magdalena","Matara","Namora","San Juan"],
            "Celendín":["Celendin","Chumuch","Cortegana","Huasmin","José Gálvez","Jorge Chávez","La Libertad de Pallán","Miguel Iglesias","Oxamarca","Sorochuco","Sucre","Utco"],
            "Chota":["Anguía","Chadín","Chalamarca","Chiguirip","Chimban","Choropampa","Chota","Cochabamba","Conchán","Huambos","Lajas","Llama","Miracosta","Paccha","Pion","Querocoto","San Juan de Licupis","Tacabamba","Tocmoche"],
            "Contumazá":["Chilete","Contumazá","Cupisnique","Guzmango","San Benito","Santa Cruz de Toledo","Tantarica","Yonán"],
            "Cutervo":["Callayuc","Choros","Cujillo","Cutervo","La Ramada","Pimpingos","Querocotillo","San Andrés de Cutervo","San Juan de Cutervo","San Luis de Lucma","Santa Cruz","Santo Domingo de la Capilla","Santo Tomás","Socota","Toribio Casanova"],
            "Hualgayoc":["Bambamarca","Chugur","Hualgayoc"],
            "Jaén":["Bellavista","Chontalí","Colasay","Huabal","Jaén","Las Pirias","Pomahuaca","Pucará","Sallique","San Felipe","San José del Alto","Santa Rosa"],
            "San Ignacio":["Chirinos","Huarango","La Coipa","Namballe","San Ignacio","San José de Lourdes","Tabaconas"],
            "San Marcos":["Chancay","Eduardo Villanueva","Gregorio Pita","Ichocán","Jose Manuel Quiroz","José Sabogal","Pedro Gálvez"],
            "San Miguel":["Bolívar","Calquis","Catilluc","El Prado","La Florida","Llapa","Nanchoc","Niepos","San Gregorio","San Miguel","San Silvestre de Conchán","Tongod","Unión Agua Blanca"],
            "San Pablo":["San Bernardino","San Luis","San Pablo","Tumbaden"],
            "Santa Cruz":["Andabamba","Catache","Chancaybaños","La Esperanza","Ninabamba","Pulán","Santa Cruz","Saucepampa","Sexi","Uticyacu","Yauyucan"]
        },
        "Cusco": {
            "Acomayo":["Acomayo","Acopia","Acos","Mosoc Llacta","Pomacanchi","Rondocan","Sangarará"],
            "Anta":["Ancahuasi","Anta","Cachimayo","Chinchaypujio","Huarocondo","Limatambo","Mollepata","Pucyura","Zurite"],
            "Calca":["Calca","Coya","Lamay","Lares","Pisac","San Salvador","Taray","Yanatile"],
            "Canas":["Checca","Kunturkanki","Langui","Layo","Pampamarca","Quehue","Tupac Amaru","Yanaoca"],
            "Canchis":["Checacupe","Combapata","Marangani","Pitumarca","San Pablo","San Pedro","Sicuani","Tinta"],
            "Cusco":["Ccorca","Cusco","Poroy","San Jerónimo","San Sebastián","Santiago","Saylla","Wanchaq"],
            "Chumbivilcas":["Capacmarca","Chamaca","Colquemarca","Llivitaca","Llusco","Quiñota","Santo Tomás","Velille"],
            "Espinar":["Alto Pichigua","Condoroma","Coporaque","Ocoruro","Pallpata","Pichigua","Suyckutambo","Yauri"],
            "La Convención":["Echarati","Huayopata","Inkawasi","Kimbiri","Maranura","Megantoni","Ocobamba","Pichari","Quellouno","Santa Ana","Santa Teresa","Vilcabamba","Villa Kintiarina","Villa Virgen"],
            "Paruro":["Accha","Ccapi","Colcha","Huanoquite","Omacha","Paccaritambo","Paruro","Pillpinto","Yaurisque"],
            "Paucartambo":["Caicay","Challabamba","Colquepata","Huancarani","Kosñipata","Paucartambo"],
            "Quispicanchi":["Andahuaylillas","Camanti","Ccatca","Ccarhuayo","Cusipata","Huaro","Lucre","Marcapata","Ocongate","Oropesa","Quiquijana","Urcos"],
            "Urubamba":["Chinchero","Huayllabamba","Machupicchu","Maras","Ollantaytambo","Urubamba","Yucay"]
        },
        "Huancavelica":{
            "Acobamba":["Acobamba","Andabamba","Anta","Caja","Marcas","Paucará","Pomacocha","Rosario"],
            "Angaraes":["Anchonga","Callanmarca","Ccochaccasa","Chincho","Congalla","Huanca Huanca","Huayllay Grande","Julcamarca","Lircay","San Antonio de Antaparco","Santo Tomás de Pata","Seclla"],
            "Castrovirreyna":["Arma","Aurahuá","Capillas","Castrovirreyna","Chupamarca","Cocas","Huachos","Huamatambo","Mollepampa","San Juan","Santa Ana","Tantara","Ticrapo"],
            "Churcampa":["Anco","Chinchihuasi","Churcampa","Cosme​","El Carmen","La Merced","Locroja","Pachamarca","Paucarbamba","San Miguel de Mayocc","San Pedro de Coris"],
            "Huancavelica":["Acobambilla","Acoria","Ascensión","Conayca","Cuenca","Huachocolpa","Huando","Huancavelica","Huayllahuara","Izcuchaca","Laria","Manta","Mariscal Cáceres","Moya","Nuevo Occoro","Palca","Pilchaca","Vilca","Yauli"],
            "Huaytará":["Ayaví","Córdova","Huayacundo Arma","Huaytará","Laramarca","Ocoyo","Pilpichaca","Querco","Quito-Arma","San Antonio de Cusicancha","San Francisco de Sangayaico","San Isidro","Santiago de Chocorvos","Santiago de Quirahuara","Santo Domingo de Capillas","Tambo"],
            "Tayacaja":["Acostambo","Acraquía","Ahuaycha","Andaymarca","Colcabamba","Daniel Hernández","Huachocolpa","Huaribamba","Ñahuimpuquio","Pampas","Pazos","Pichos","Quichuas","Quishuar","Roble","Salcabamba","Salcahuasi","San Marcos de Rocchac","Santiago de Tucuma","Surcubamba","Tintay Puncu"]
        },
        "Huánuco":{
            "Ambo":["Ambo","Cayna","Colpas","Conchamarca","Huácar","San Francisco","San Rafael","Tomay Kichwa"],
            "Dos de Mayo":["Chuquis","La Unión","Marías","Pachas","Quivilla","Ripán","Shunqui","Sillapata","Yanas"],
            "Huacaybamba":["Canchabamba","Cochabamba","Huacaybamba","Pinra"],
            "Huamalíes":["Arancay","Chavín de Pariarca","Jacas Grande","Jircán","Llata","Miraflores","Monzón","Punchao","Puños","Singa","Tantamayo"],
            "Huánuco":["Amarilis","Chinchao","Churumbamba","Huánuco","Margos","Pillco Marca","Quisqui","San Francisco de Cayrán","San Pablo de Pillao","San Pedro de Chaulán","Santa María del Valle","Yacus","Yarumayo"],
            "Lauricocha":["Baños","Jesús","Jivia","Queropalca","Rondos","San Francisco de Asís","San Miguel de Cauri"],
            "Leoncio Prado":["Castillo Grande","Daniel Alomía Robles","Hermilio Valdizán","José Crespo y Castillo","Luyando","Mariano Dámaso Beraun","Pucayacu","Pueblo Nuevo","Rupa-Rupa","Santo Domingo de Anda"],
            "Marañón":["Cholón","Huacrachuco","La Morada​","San Buenaventura","Santa Rosa de Alto Yanajanca"],
            "Pachitea":["Chaglla","Molino","Panao","Umari"],
            "Puerto Inca":["Codo del Pozuzo","Honoria","Puerto Inca","Tournavista","Yuyapichis"],
            "Yarowilca":["Aparicio Pomares","Cáhuac","Chacabamba","Chavinillo","Choras","Jacas Chico","Obas","Pampamarca"]
        },
        "Ica":{
            "Chincha":["Alto Larán","Chavín","Chincha Alta","Chincha Baja","El Carmen","Grocio Prado","Pueblo Nuevo","San Juan de Yanac","San Pedro de Huacarpana","Sunampe","Tambo de Mora"],
            "Ica":["Ica","La Tinguiña","Los Aquijes","Ocucaje","Pachacútec","Parcona","Pueblo Nuevo","Salas","San José de los Molinos","San Juan Bautista","Santiago","Subtanjalla","Tate","Yauca del Rosario"],
            "Nazca":["Changuillo","El Ingenio","Marcona","Nazca","Vista Alegre"],
            "Palpa":["Llipata","Palpa","Río Grande","Santa Cruz","Tibillo"],
            "Pisco":["Huancano","Humay","Independencia","Paracas","Pisco","San Andrés","San Clemente","Túpac Amaru Inca"]
        },
        "Junín":{
            "Chanchamayo":["Chanchamayo","Perené","Pichanaqui","San Luis de Shuaro","San Ramón","Vítoc"],
            "Chupaca":["Áhuac","Chongos Bajo","Chupaca","Huáchac","Huamancaca Chico","San Juan de Jarpa","San Juan de Yscos","Tres de Diciembre","Yanacancha"],
            "Concepción":["Aco","Andamarca","Chambara","Cochas","Comas","Concepción","Heroínas Toledo","Manzanares","Mariscal Castilla","Matahuasi","Mito","Nueve de Julio","Orcotuna","San José de Quero","Santa Rosa de Ocopa"],
            "Huancayo":["Carhuacallanga","Chacapampa","Chicche","Chilca","Chongos Alto","Chupuro","Colca","Cullhuas","El Tambo","Huacrapuquio","Hualhuas","Huancán","Huancayo","Huasicancha","Huayucachi","Ingenio","Pariahuanca","Pilcomayo","Pucará","Quichuay","Quilcas","San Agustín de Cajas","San Jerónimo de Tunán","San Pedro de Saño","Sapallanga","Santo Domingo de Acobamba","Sicaya","Viques"],
            "Jauja":["Acolla","Apata","Ataura","Canchayllo","Curicaca","El Mantaro","Huamalí","Huaripampa","Huertas","Janjaillo","Jauja","Julcán","Leonor Ordóñez","Llocllapampa","Marco","Masma","Masma Chicche","Molinos","Monobamba","Muqui","Muquiyauyo","Paca","Paccha","Pancán","Parco","Pomacancha","Ricrán","San Lorenzo","San Pedro de Chunán","Sausa","Sincos","Tunanmarca","Yauli","Yauyos"],
            "Junín":["Carhuamayo","Junín","Ondores","Ulcumayo"],
            "Satipo":["Coviriali","Llaylla","Mazamari","Pampa Hermosa","Pangoa","Río Negro","Río Tambo","Satipo","Vizcatán del Ene"],
            "Tarma":["Acobamba","Huaricolca","Huasahuasi","La Unión","Palca","Palcamayo","San Pedro de Cajas","Tapo","Tarma"],
            "Yauli":["Chacapalpa","Huayhuay","La Oroya","Marcapomacocha","Morococha","Paccha","Santa Barbara de Carhuacayán","Santa Rosa de Sacco","Suitucancha","Yauli"]
        },
        "La Libertad":{
            "Ascope":["Ascope","Casa Grande","Chicama","Chocope","Magdalena de Cao","Paiján","Rázuri","Santiago de Cao"],
            "Bolívar":["Bambamarca","Bolívar","Condormarca","Longotea","Uchumarca","Ucuncha"],
            "Chepén":["Chepén","Pacanga","Pueblo Nuevo"],
            "Gran Chimú":["Cascas","Lucma","Marmot","Sayapullo"],
            "Julcán":["Calamarca","Carabamba","Huaso","Julcán"],
            "Otuzco":["Agallpampa","Charat","Huaranchal","La Cuesta","Mache","Otuzco","Paranday","Salpo","Sinsicap","Usquil"],
            "Pacasmayo":["Guadalupe","Jequetepeque","Pacasmayo","San José","San Pedro de Lloc"],
            "Pataz":["Buldibuyo","Chilia","Huancaspata","Huaylillas","Huayo","Ongón","Parcoy","Pataz","Pías","Santiago de Challas","Taurija","Tayabamba","Urpay"],
            "Sánchez Carrión":["Chugay","Cochorco","Curgos","Huamachuco","Marcabal","Sanagorán","Sarín","Sartimbamba"],
            "Santiago de Chuco":["Angasmarca","Cachicadán","Mollebamba","Mollepata","Quiruvilca","Santa Cruz de Chuca","Santiago de Chuco","Sitabamba"],
            "Trujillo":["El Porvenir","Florencia de Mora","Huanchaco","La Esperanza","Laredo","Moche","Poroto","Salaverry","Simbal","Trujillo","Víctor Larco Herrera"],
            "Virú":["Chao","Guadalupito","Virú"]
        },
        "Lambayeque":{
            "Chiclayo":["Cayaltí","Chiclayo","Chongoyape","Eten","José Leonardo Ortiz","La Victoria","Lagunas","Monsefú","Nueva Arica","Oyotún","Pátapo","Picsi","Pimentel","Pomalca","Pucalá","Puerto Eten","Reque","Santa Rosa","Tumán","Zaña"],
            "Lambayeque":["Chóchope","Íllimo","Jayanca","Lambayeque","Mochumí","Mórrope","Motupe","Olmos","Pacora","Salas","San José","Túcume"],
            "Ferreñafe":["Cañaris","Ferreñafe","Incahuasi","Manuel Antonio Mesones Muro","Pítipo","Pueblo Nuevo"]
        },
        "Lima": {
            "Barranca":["Barranca","Paramonga","Pativilca","Supe","Supe Puerto"],
            "Cajatambo":["Cajatambo","Copa","Gorgor","Huancapón","Manás"],
            "Callao":["Bellavista","Callao","Carmen de La Legua-Reynoso","La Perla","La Punta","Mi Perú","Ventanilla"],
            "Canta":["Arahuay","Canta","Huamantanga","Huaros","Lachaqui","San Buenaventura","Santa Rosa de Quives"],
            "Cañete":["Asia","Calango","Cerro Azul","Chilca","Coayllo","Imperial","Lunahuaná","Mala","Nuevo Imperial","Pacarán","Quilmaná","San Antonio","San Luis","San Vicente de Cañete","Santa Cruz de Flores","Zúñiga"],
            "Huaral":["Huaral", "Atavillos Alto", "Aucallama"],
            "Huarochirí":["Antioquía","Callahuanca","Carampoma","Chicla","Cuenca","Huachupampa","Huanza","Huarochirí","Lahuaytambo","Langa","Laraos","Mariatana","Matucana","Ricardo Palma","San Andrés de Tupicocha","San Antonio","San Bartolomé","San Damián","San Jerónimo de Surco","San Juan de Iris","San Juan de Tantaranche","San Lorenzo de Quinti","San Mateo","San Mateo de Otao","San Pedro de Casta","San Pedro de Huancayre","Sangallaya","Santa Cruz de Cocachacra","Santa Eulalia","Santiago de Anchucaya","Santiago de Tuna","Santo Domingo de los Olleros"],
            "Huaura":["Ámbar","Caleta de Carquín","Checras","Huacho","Hualmay","Huaura","Leoncio Prado","Paccho","Santa Leonor","Santa María","Sayán","Végueta"],
            "Lima": ["Ancón","Ate","Barranco","Breña","Carabayllo","Chaclacayo","Chorrillos","Cieneguilla","Comas","El Agustino","Huaycán","Independencia","Jesús María","La Molina","La Victoria","Lima","Lince","Los Olivos","Lurigancho","Lurín","Magdalena del Mar","Miraflores","Pachacamac","Pueblo Libre","Pucusana","Puente Piedra","Punta Hermosa","Punta Negra","Rímac","San Bartolo","San Borja","San Isidro","San Juan de Lurigancho","San Juan de Miraflores","San Luis","San Martín de Porres","San Miguel","Santiago de Surco","Santa Anita","Santa Leonor","Santa María del Mar","Santa Rosa","Villa El Salvador","Villa María del Triunfo"],
            "Oyón":["Andajes","Caujul","Cochamarca","Naván","Oyón","Pachangara"],
            "Yauyos":["Alis","Ayauca","Ayavirí","Azángaro","Cacra","Carania","Catahuasi","Chocos","Cochas","Colonia","Hongos","Huampará","Huancaya","Huangáscar","Huantán","Huáñec","Laraos","Lincha","Madeán","Miraflores","Omas","Putinza","Quinches","Quinocay","San Joaquín","San Pedro de Pilas","Tanta","Tauripampa","Tomas","Tupe","Víñac","Vitis","Yauyos"]
        },
        "Loreto":{
            "Alto Amazonas":["Balsapuerto", "Jeberos", "Lagunas", "Santa Cruz", "Teniente César López Rojas", "Yurimaguas"],
            "Datem del Marañon":["Andoas", "Barranca", "Cahuapanas", "Manseriche", "Morona", "Pastaza"],
            "Loreto":["Nauta", "Parinari", "Tigre", "Trompeteros", "Urarinas"],
            "Maynas":["Punchana","Iquitos","Alto Nanay","Fernando Lores","Indiana","Las Amazonas","Mazan","Napo","Torres Causana","Belén"],
            "Putumayo":["Putumayo", "Rosa Panduro", "Teniente Manuel Clavero", "Yaguas"],
            "Requena":["Alto Tapiche", "Capelo", "Emilio San Martín", "Maquía", "Puinahua", "Requena", "Saquena", "Soplin", "Tapiche", "Jenaro Herrera", "Yaquerana"],
            "Ucayali":["Contamana", "Inahuaya", "Padre Márquez", "Pampa Hermosa", "Sarayacu", "Alfredo Vargas Guerra"],
            "Mariscal Ramón Castilla":["Pebas", "Ramón Castilla", "San Pablo", "Yavarí"]
        },
        "Madre de Dios":{
            "Tambopata":["Tambopata", "Inambari", "Las Piedras", "Laberinto"],
            "Manu":["Manu", "Fitzcarrald", "Madre de Dios", "Huepetuhe"],
            "Tahuamanu":["Iñapari", "Iberia", "Tahuamanu"]
        },
        "Moquegua":{
            "Mariscal Nieto":["Carumas", "Cuchumbaya", "Moquegua", "Samegua", "San Cristóbal de Calacoa", "Torata"],
            "General Sánches Cerro":["Chojata", "Coalaque", "Ichuña", "La Capilla", "Lloque", "Matalaque", "Omate", "Puquina", "Quinistaquillas", "Ubinas", "Yunga"],
            "Ilo":["El Algarrobal", "Ilo", "Pacocha"]
        },
        "Pasco":{
            "Pasco":["Chaupimarca", "Huachón", "Huariaca", "Huayllay", "Ninacaca", "Pallanchacra", "Paucartambo", "San Francisco de Asís de Yarusyacán", "Simón Bolívar", "Ticlacayán", "Tinyahuarco", "Vicco", "Yanacancha"],
            "Daniel Alcides Carrión":["Chacayán", "Goyllarisquizga", "Páucar", "San Pedro de Pillao", "Santa Ana de Tusi", "Tápuc", "Vilcabamba", "Yanahuanca"],
            "Oxapampa":["Chontabamba", "Constitución", "Huancabamba", "Oxapampa", "Palcazu", "Pozuzo", "Puerto Bermúdez", "Villa Rica"]
        },
        "Piura":{
            "Ayabaca":["Ayabaca", "Frías", "Jililí", "Lagunas", "Montero", "Pacaipampa", "Paimas", "Sapillica", "Sicchez", "Suyo"],
            "Huancabamba":["Huancabamba", "Canchaque", "El Carmen de la Frontera", "Huarmaca", "Lalaquiz", "San Miguel de El Faique", "Sondor", "Sondorillo"],
            "Morropón":["Chulucanas", "Buenos Aires", "Chalaco", "La Matanza", "Morropón", "Salitral", "San Juan de Bigote", "Santa Catalina de Mossa", "Santo Domingo", "Yamango"],
            "Paita":["Paita", "Amotape", "Colán", "El Arenal", "La Huaca", "Tamarindo", "Vichayal"],
            "Piura":["Castilla", "Catacaos", "Cura Mori", "El Tallán", "La Arena", "La Unión", "Las Lomas", "Piura", "Tambogrande", "Veintiséis de Octubre"],
            "Sechura":["Bellavista de la Unión", "Bernal", "Cristo Nos Valga", "Rinconada-Llicuar", "Sechura", "Vice"],
            "Sullana":["Bellavista", "Ignacio Escudero", "Lancones", "Marcavelica", "Miguel Checa", "Querecotillo", "Salitral", "Sullana"],
            "Talara":["El Alto", "La Brea", "Lobitos", "Los Órganos", "Máncora", "Pariñas"]
        },
        "Puno":{
            "Azángaro":["Achaya","Arapa","Asillo","Azángaro","Caminaca","Chupa","José Domingo Choquehuanca","Muñani","Potoni","Samán","San Antón","San Jose","San Juan de Salinas","Santiago de Pupuja","Tirapata"],
            "Carabaya":["Ajoyani","Ayapata","Coasa","Corani","Crucero","Ituata","Macusani","Ollachea","San Gabán","Usicayos"],
            "Chucuito":["Desaguadero","Huacullani","Juli","Kelluyo","Pisacoma","Pomata","Zepita"],
            "El Collao":["Capaso","Conduriri","Ilave","Pilcuyo","Santa Rosa"],
            "Huancané":["Cojata","Huancané","Huatasani","Inchupalla","Pusi","Rosaspata","Taraco","Vilque Chico"],
            "Lampa":["Cabanilla","Calapuja","Lampa","Nicasio","Ocuviri","Palca","Paratía","Pucará","Santa Lucía","Vilavila"],
            "Melgar":["Antauta","Ayaviri","Cupi","Llalli","Macari","Nuñoa","Orurillo","Santa Rosa","Umachiri"],
            "Moho":["Conima","Huayrapata","Moho","Tilali"],
            "Puno":["Ácora","Amantaní","Atuncolla","Capachica","Chucuito","Coata","Huata","Mañazo","Paucarcolla","Pichacani","Platería","Puno","San Antonio","Tiquillaca","Vilque"],
            "San Antonio de Putina":["Ananea","Pedro Vilca Apaza","Putina","Quilcapuncu","Sina"],
            "San Román":["Cabana","Cabanillas","Caracoto","Juliaca","San Miguel"],
            "Sandia":["Alto Inambari","Cuyocuyo","Limbani","Patambuco","Phara","Quiaca","San Juan del Oro","San Pedro de Putinapunco","Sandia","Yanahuaya"],
            "Yunguyo":["Anapia","Copani","Cuturapi","Ollaraya","Tinicachi","Unicachi","Yunguyo"]
        },
        "San Martín":{
            "Bellavista":["Alto Biavo", "Bajo Biavo", "Bellavista", "Huallaga", "San Pablo", "San Rafael"],
            "El Dorado":["Agua Blanca", "San José de Sisa", "San Martín", "Santa Rosa", "Shatoja"],
            "Huallaga":["Alto Saposoa", "El Eslabón", "Piscoyacu", "Sacanche", "Saposoa", "Tingo de Saposoa"],
            "Lamas":["Alonso de Alvarado", "Barranquita", "Caynarachi", "Cuñunbuqui", "Lamas", "Pinto Recodo", "Rumisapa", "San Roque de Cumbaza", "Shanao", "Tabalosos", "Zapatero"],
            "Mariscal Cáceres":["Campanilla", "Huicungo", "Juanjuí", "Pachiza", "Pajarillo"],
            "Moyobamba":["Calzada", "Habana", "Jepelacio", "Moyobamba", "Soritor", "Yantalo"],
            "Picota":["Buenos Aires", "Caspizapa", "Picota", "Pilluana", "Pucacaca", "San Cristóbal", "San Hilarión", "Shamboyacu", "Tingo de Ponasa", "Tres Unidos"],
            "Rioja":["Awajún", "Elias Soplin Vargas", "Nueva Cajamarca", "Pardo Miguel", "Posic", "Rioja", "San Fernando", "Yorongos", "Yuracyacu"],
            "San Martín":["Alberto Leveau", "Cacatachi", "Chazuta", "Chipurana", "El Porvenir", "Huimbayoc", "Juan Guerra", "La Banda de Shilcayo", "Morales", "Papaplaya", "San Antonio", "Sauce", "Shapaja", "Tarapoto"],
            "Tocache":["Nuevo Progreso", "Pólvora", "Shunte", "Tocache", "Uchiza"]
        },
        "Tacna":{
            "Candarave":["Cairani", "Camilaca", "Candarave", "Curibaya", "Huanuara", "Quilahuani"],
            "Jorge Basadre":["Ilabaya", "Ite", "Locumba"],
            "Tacna":["Alto de la Alianza", "Calana", "Ciudad Nueva", "Coronel Gregorio Albarracín Lanchipa", "Inclán", "La Yarada-Los Palos", "Pachía", "Palca", "Pocollay", "Sama", "Tacna"],
            "Tarata":["Estique", "Estique Pampa", "Héroes Albarracín", "Sitajara", "Susapaya", "Tarata", "Tarucachi", "Ticaco"]
        },
        "Tumbes":{
            "Contralmirante Villar":["Canoas de Punta Sal", "Casitas", "Zorritos"],
            "Tumbes":["Corrales", "La Cruz", "Pampas de Hospital", "San Jacinto", "San Juan de la Virgen", "Tumbes"],
            "Zarumilla":["Aguas Verdes", "Matapalo", "Papayal", "Zarumilla"]
        },
        "Ucayali":{
            "Atalaya":["Raimondi", "Sepahua", "Tahuanía", "Yurúa"],
            "Coronel Portillo":["Callería", "Campoverde", "Iparía", "Manantay", "Masisea", "Nueva Requena", "Yarinacocha"],
            "Padre Abad":["Alexander von Humboldt", "Curimaná", "Irázola", "Neshuya", "Padre Abad"],
            "Purús":["Purús"]
        }
    },

    // 🔹 Devuelve lista de departamentos
    departamentos() {
        return Object.keys(this.data);
    },

    // 🔹 Devuelve provincias según departamento
    provincias(departamento) {
        return departamento && this.data[departamento]
            ? Object.keys(this.data[departamento])
            : [];
    },

    // 🔹 Devuelve distritos según dep/prov
    distritos(departamento, provincia) {
        return departamento && provincia && this.data[departamento]?.[provincia]
            ? this.data[departamento][provincia]
            : [];
    }
};

window.ubigeo = ubigeo; // lo deja accesible en profile.js y register.js