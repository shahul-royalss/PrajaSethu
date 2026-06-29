/**
 * Andhra Pradesh administrative geography — the 26 districts (2022 reorganisation)
 * and their revenue mandals. Used by the citizen form's location pickers and the
 * officer location filters. Village/ward is captured as free text (there are
 * ~17,000 of them); mandal + district is the routing-relevant granularity.
 *
 * This is curated reference data; the form also allows free entry, so a mandal not
 * listed here can still be typed in.
 */
export const AP_DISTRICTS_MANDALS: Record<string, string[]> = {
  Srikakulam: [
    'Srikakulam', 'Amadalavalasa', 'Burja', 'Etcherla', 'Gara', 'Ranastalam', 'Sarubujjili',
    'Ponduru', 'Laveru', 'Narasannapeta', 'Polaki', 'Jalumuru', 'Saravakota', 'Pathapatnam',
    'Hiramandalam', 'Kotabommali', 'Tekkali', 'Santhabommali', 'Nandigam', 'Kanchili',
    'Kaviti', 'Ichchapuram', 'Sompeta', 'Mandasa', 'Vajrapukotturu', 'Palasa',
  ],
  'Parvathipuram Manyam': [
    'Parvathipuram', 'Balijipeta', 'Bobbili', 'Salur', 'Pachipenta', 'Makkuva', 'Garugubilli',
    'Gummalakshmipuram', 'Kurupam', 'Jiyyammavalasa', 'Komarada', 'Seethanagaram', 'Veeraghattam',
    'Palakonda', 'Bhamini', 'Saluru', 'Mentada',
  ],
  Vizianagaram: [
    'Vizianagaram', 'Gajapathinagaram', 'Bondapalli', 'Gantyada', 'Nellimarla', 'Bhogapuram',
    'Denkada', 'Pusapatirega', 'Cheepurupalli', 'Garividi', 'Gurla', 'Merakamudidam',
    'Therlam', 'Dattirajeru', 'Mentada', 'Vepada', 'Lakkavarapukota', 'Srungavarapukota',
    'Jami', 'Badangi',
  ],
  Visakhapatnam: [
    'Visakhapatnam (Urban)', 'Visakhapatnam (Rural)', 'Gajuwaka', 'Pedagantyada', 'Mulagada',
    'Bheemunipatnam', 'Anandapuram', 'Padmanabham', 'Pendurthi', 'Seethammadhara',
  ],
  Anakapalli: [
    'Anakapalli', 'Kasimkota', 'Munagapaka', 'Yelamanchili', 'Rambilli', 'Atchutapuram',
    'Munagapaka', 'Chodavaram', 'Devarapalli', 'Kotauratla', 'Madugula', 'Butchayyapeta',
    'Cheedikada', 'Nathavaram', 'Ravikamatham', 'Narsipatnam', 'Golugonda', 'Rolugunta',
    'Makavarapalem', 'Nakkapalli', 'Payakaraopeta', 'Kotananduru', 'S. Rayavaram',
  ],
  'Alluri Sitharama Raju': [
    'Paderu', 'Araku Valley', 'Ananthagiri', 'Dumbriguda', 'Hukumpeta', 'Pedabayalu',
    'Munchingiput', 'Chintapalli', 'G. Madugula', 'Koyyuru', 'Gangaraju Madugula',
    'Rampachodavaram', 'Devipatnam', 'Y. Ramavaram', 'Maredumilli', 'Addateegala',
    'Rajavommangi', 'Chintoor', 'Kunavaram', 'V.R. Puram', 'Etapaka', 'Gudem Kotha Veedhi',
  ],
  Kakinada: [
    'Kakinada (Urban)', 'Kakinada (Rural)', 'Samalkota', 'Pithapuram', 'Gollaprolu',
    'U. Kothapalli', 'Thondangi', 'Kotananduru', 'Tuni', 'Sankhavaram', 'Prathipadu',
    'Yeleswaram', 'Jaggampeta', 'Kirlampudi', 'Peddapuram', 'Gandepalli', 'Karapa',
  ],
  'East Godavari': [
    'Rajamahendravaram (Urban)', 'Rajamahendravaram (Rural)', 'Kadiyam', 'Anaparthi', 'Biccavolu',
    'Rangampeta', 'Korukonda', 'Seethanagaram', 'Gokavaram', 'Rajanagaram', 'Nidadavole',
    'Kovvur', 'Chagallu', 'Tallapudi', 'Gopalapuram', 'Devarapalli', 'Nallajerla',
  ],
  Konaseema: [
    'Amalapuram', 'Allavaram', 'Ambajipeta', 'Ainavilli', 'Mummidivaram', 'I. Polavaram',
    'Katrenikona', 'Uppalaguptam', 'Razole', 'Malikipuram', 'Mamidikuduru', 'Sakhinetipalli',
    'Kothapeta', 'P. Gannavaram', 'Ravulapalem', 'Atreyapuram', 'Alamuru', 'Mandapeta',
    'Rayavaram', 'Kapileswarapuram', 'Gangavaram',
  ],
  'West Godavari': [
    'Bhimavaram', 'Veeravasaram', 'Palacole', 'Poduru', 'Achanta', 'Penugonda', 'Penumantra',
    'Undi', 'Kalla', 'Akiveedu', 'Undrajavaram', 'Tanuku', 'Attili', 'Iragavaram',
    'Tadepalligudem', 'Pentapadu', 'Ganapavaram', 'Nidamarru', 'Palakoderu', 'Mogalthur',
  ],
  Eluru: [
    'Eluru', 'Denduluru', 'Pedavegi', 'Pedapadu', 'Bhimadole', 'Nidamarru', 'Ganapavaram',
    'Unguturu', 'Nuzvid', 'Agiripalli', 'Musunuru', 'Chatrai', 'Reddigudem', 'Gampalagudem',
    'Tiruvuru', 'A. Konduru', 'Vissannapeta', 'Lingapalem', 'Chintalapudi', 'Kamavarapukota',
    'Jangareddygudem', 'Buttayagudem', 'Polavaram', 'Koyyalagudem', 'Jeelugumilli',
  ],
  Krishna: [
    'Machilipatnam', 'Gudur', 'Pedana', 'Bantumilli', 'Kruthivennu', 'Avanigadda',
    'Nagayalanka', 'Koduru', 'Mopidevi', 'Challapalli', 'Ghantasala', 'Movva', 'Pamarru',
    'Pedaparupudi', 'Gudivada', 'Nandivada', 'Gudlavalleru', 'Mudinepalli', 'Kankipadu',
    'Vuyyuru', 'Pamidimukkala', 'Thotlavalluru', 'Bapulapadu', 'Gannavaram', 'Unguturu',
    'Vijayawada Rural',
  ],
  NTR: [
    'Vijayawada (Central)', 'Vijayawada (West)', 'Vijayawada (East)', 'Penamaluru', 'Ibrahimpatnam',
    'G. Konduru', 'Mylavaram', 'Reddigudem', 'Kanchikacherla', 'Veerullapadu', 'Vatsavai',
    'Jaggayyapeta', 'Penuganchiprolu', 'Nandigama', 'Chandarlapadu', 'Tiruvuru',
    'Vissannapeta', 'A. Konduru',
  ],
  Guntur: [
    'Guntur (East)', 'Guntur (West)', 'Pedakakani', 'Medikonduru', 'Thullur', 'Tadepalli',
    'Mangalagiri', 'Duggirala', 'Tenali', 'Kollipara', 'Vemuru', 'Tsundur', 'Kakumanu',
    'Ponnur', 'Chebrolu', 'Prathipadu', 'Pedanandipadu', 'Vatticherukuru', 'Phirangipuram',
    'Amaravathi', 'Tadikonda', 'Bapatla',
  ],
  Palnadu: [
    'Narasaraopet', 'Chilakaluripet', 'Sattenapalli', 'Rajupalem', 'Nakarikallu', 'Muppalla',
    'Nadendla', 'Edlapadu', 'Phirangipuram', 'Vinukonda', 'Bollapalli', 'Ipur', 'Savalyapuram',
    'Nuzendla', 'Gurazala', 'Macherla', 'Veldurthi', 'Durgi', 'Rentachintala', 'Karempudi',
    'Piduguralla', 'Dachepalli', 'Machavaram', 'Bellamkonda', 'Krosuru', 'Amaravathi',
  ],
  Bapatla: [
    'Bapatla', 'Karlapalem', 'Pittalavanipalem', 'Nizampatnam', 'Repalle', 'Cherukupalli',
    'Bhattiprolu', 'Nagaram', 'Vetapalem', 'Chirala', 'Chinaganjam', 'Parchur', 'Karamchedu',
    'Inkollu', 'Yeddanapudi', 'Addanki', 'Ballikurava', 'Santhamaguluru', 'Korisapadu', 'Martur',
  ],
  Prakasam: [
    'Ongole', 'Kothapatnam', 'Maddipadu', 'Chimakurthy', 'Santhanuthalapadu', 'Tangutur',
    'Naguluppalapadu', 'Singarayakonda', 'Kandukur', 'Lingasamudram', 'Gudluru', 'Ulavapadu',
    'Voletivaripalem', 'Kanigiri', 'Pamuru', 'Hanumanthunipadu', 'Konakanamitla', 'Darsi',
    'Donakonda', 'Kurichedu', 'Mundlamuru', 'Tripuranthakam', 'Yerragondapalem', 'Markapur',
    'Tarlupadu', 'Dornala', 'Pullalacheruvu', 'Ardhaveedu', 'Cumbum', 'Bestavaripeta',
    'Racherla', 'Giddalur', 'Komarolu', 'Podili',
  ],
  Nellore: [
    'Nellore (Urban)', 'Nellore (Rural)', 'Buchireddypalem', 'Kovur', 'Indukurpet', 'Thotapalligudur',
    'Muthukur', 'Venkatachalam', 'Manubolu', 'Gudur', 'Chillakur', 'Kota', 'Vakadu',
    'Chittamur', 'Sydapuram', 'Dakkili', 'Venkatagiri', 'Balayapalli', 'Rapur', 'Podalakur',
    'Kaligiri', 'Vidavalur', 'Sangam', 'Anantasagaram', 'Atmakur', 'Marripadu', 'Udayagiri',
    'Duttalur', 'Vinjamur', 'Kavali', 'Bogole', 'Kodavalur', 'Allur', 'Jaladanki',
  ],
  Kurnool: [
    'Kurnool', 'Kallur', 'Orvakal', 'Kodumur', 'Gudur', 'C. Belagal', 'Veldurthi', 'Krishnagiri',
    'Devanakonda', 'Aspari', 'Adoni', 'Yemmiganur', 'Mantralayam', 'Kosigi', 'Kowthalam',
    'Pedda Kadabur', 'Holagunda', 'Alur', 'Halaharvi', 'Pattikonda', 'Tuggali', 'Maddikera',
    'Nandavaram', 'Gonegandla', 'Dhone', 'Peapally',
  ],
  Nandyal: [
    'Nandyal', 'Gospadu', 'Mahanandi', 'Sirivella', 'Rudravaram', 'Banaganapalle', 'Owk',
    'Koilkuntla', 'Kolimigundla', 'Sanjamala', 'Allagadda', 'Chagalamarri', 'Uyyalawada',
    'Dornipadu', 'Gadivemula', 'Panyam', 'Bandi Atmakur', 'Velgodu', 'Atmakur', 'Pamulapadu',
    'Kothapalli', 'Jupadu Bungalow', 'Srisailam', 'Nandikotkur', 'Pagidyala', 'Midthur',
  ],
  Anantapur: [
    'Anantapur (Urban)', 'Anantapur (Rural)', 'Rapthadu', 'Atmakur', 'Bukkarayasamudram',
    'Garladinne', 'Singanamala', 'Pamidi', 'Tadipatri', 'Yadiki', 'Peddapappur', 'Putlur',
    'Yellanur', 'Narpala', 'Kanaganapalle', 'Ramagiri', 'Raptadu', 'Kambadur', 'Kalyandurg',
    'Settur', 'Kundurpi', 'Brahmasamudram', 'Kanekal', 'Bommanahal', 'Vidapanakal',
    'Guntakal', 'Gooty', 'Peddavadugur', 'Uravakonda', 'Vajrakarur', 'Beluguppa', 'D. Hirehal',
  ],
  'Sri Sathya Sai': [
    'Puttaparthi', 'Bukkapatnam', 'Kothacheruvu', 'Dharmavaram', 'Bathalapalle', 'Mudigubba',
    'Tanakallu', 'Nallacheruvu', 'Amadagur', 'Gandlapenta', 'Kadiri', 'Nallamada', 'Talupula',
    'Nambulapulakunta', 'Penukonda', 'Roddam', 'Somandepalle', 'Gorantla', 'Hindupur',
    'Lepakshi', 'Chilamathur', 'Parigi', 'Madakasira', 'Agali', 'Rolla', 'Amarapuram',
    'Gudibanda', 'Kanaganapalle',
  ],
  'YSR Kadapa': [
    'Kadapa', 'Chennur', 'Yerraguntla', 'Kamalapuram', 'Vallur', 'Pendlimarri', 'Chinthakommadinne',
    'Vontimitta', 'Sidhout', 'Atlur', 'Chapadu', 'Proddatur', 'Rajupalem', 'Mydukur', 'Khajipet',
    'Jammalamadugu', 'Mylavaram', 'Peddamudium', 'Kondapuram', 'Muddanur', 'Lingala',
    'Pulivendula', 'Simhadripuram', 'Vempalle', 'Thondur', 'Vemula',
  ],
  Annamayya: [
    'Rayachoti', 'Lakkireddipalle', 'Ramapuram', 'Veeraballe', 'Galiveedu', 'Chinnamandem',
    'Sambepalle', 'T. Sundupalle', 'Rajampet', 'Nandalur', 'Penagaluru', 'Chitvel', 'Pullampeta',
    'Obulavaripalle', 'Rly. Koduru', 'Madanapalle', 'Nimmanapalle', 'Ramasamudram',
    'Thamballapalle', 'Peddamandyam', 'Mulakalacheruvu', 'B. Kothakota', 'Kurabalakota',
    'Pileru', 'Kalakada', 'Kalikiri', 'Gurramkonda', 'Valmikipuram',
  ],
  Tirupati: [
    'Tirupati (Urban)', 'Tirupati (Rural)', 'Tiruchanur', 'Chandragiri', 'Chinnagottigallu',
    'Yerpedu', 'Renigunta', 'Srikalahasti', 'Thottambedu', 'Yerravaripalem', 'Pakala',
    'Ramachandrapuram', 'Satyavedu', 'Varadaiahpalem', 'Nagalapuram', 'Pichatur', 'K.V.B. Puram',
    'Buchinaidu Kandriga', 'Naidupeta', 'Ozili', 'Sullurpeta', 'Tada', 'Doravarisatram',
    'Vakadu', 'Kota', 'Gudur', 'Venkatagiri', 'Balayapalli', 'Chillakur', 'Manubolu',
  ],
  Chittoor: [
    'Chittoor (Urban)', 'Chittoor (Rural)', 'Gangadhara Nellore', 'Yadamari', 'Penumuru',
    'Bangarupalem', 'Palasamudram', 'Gudipala', 'Puttalapattu', 'Irala', 'Karvetinagar',
    'Vedurukuppam', 'Srirangarajapuram', 'Palamaner', 'Venkatagirikota', 'Baireddipalle',
    'Gangavaram', 'Punganur', 'Chowdepalle', 'Peddapanjani', 'Somala', 'Sodam', 'Pulicherla',
    'Rompicherla', 'Nagari', 'Vijayapuram', 'Nindra', 'Vadamalapeta', 'Puttur', 'Pichatur',
    'Kuppam', 'Gudupalle', 'Ramakuppam', 'Santhipuram', 'Shantipuram',
  ],
};

export const AP_DISTRICTS = Object.keys(AP_DISTRICTS_MANDALS);

// A few mandals have well-known village/ward seeds for the picker; everything else
// is free text in the form.
export const VILLAGES_BY_MANDAL: Record<string, string[]> = {
  Kuppam: ['Kuppam', 'Gudupalle', 'Sakrayapeta', 'Ramakuppam', 'Cheldiganipalle', 'Santhipuram'],
  Ramakuppam: ['Ramakuppam', 'Veeraksamakkapalle', 'Gangadasanapalle'],
  Pulivendula: ['Pulivendula', 'Vemula', 'Simhadripuram', 'Lingala', 'Vempalle'],
  'Kadapa': ['Kadapa', 'Chennur', 'Yerraguntla', 'Kamalapuram'],
};
