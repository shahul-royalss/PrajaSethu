import { en } from './en';

// Per-language overrides of the English source (en.ts). Any missing key falls back
// to English automatically (see I18nProvider). Populated by translations.gen.ts.
import { generated } from './translations.gen';

export type Dict = Partial<typeof en>;

// Hand-maintained additions for keys introduced after the generated snapshot.
// Merged ON TOP of translations.gen.ts so regenerating that file never wipes them.
const extras: Record<string, Dict> = {
  hi: {
    noVoiceHint: 'इस डिवाइस पर आपकी भाषा की आवाज़ उपलब्ध नहीं है, इसलिए प्रश्न बोलकर नहीं सुनाए जा सकते। सब कुछ काम करता है — कृपया स्क्रीन पर प्रश्न पढ़ें।',
    navHome: 'होम', navTrack: 'ट्रैक', navNew: 'नई शिकायत', navHeatmap: 'हीटमैप', navAnalytics: 'विश्लेषण', navConsole: 'कंसोल',
    assistDept: 'संबंधित विभाग', assistCallDept: 'विभाग हेल्पलाइन पर कॉल करें', assistGeneral: 'सामान्य शिकायत हेल्पलाइन', assistVisit: 'आमने-सामने मदद चाहिए? आपके ग्राम/वार्ड सचिवालय के कर्मचारी भी आपकी मदद कर सकते हैं।',
  },
  te: {
    noVoiceHint: 'ఈ పరికరంలో మీ భాషకు వాయిస్ అందుబాటులో లేదు, కాబట్టి ప్రశ్నలను చదివి వినిపించలేము. అన్నీ పని చేస్తాయి — దయచేసి స్క్రీన్‌పై ప్రశ్నలను చదవండి.',
    navHome: 'హోమ్', navTrack: 'ట్రాక్', navNew: 'కొత్త ఫిర్యాదు', navHeatmap: 'హీట్‌మ్యాప్', navAnalytics: 'విశ్లేషణ', navConsole: 'కన్సోల్',
    assistDept: 'సంబంధిత విభాగం', assistCallDept: 'విభాగం హెల్ప్‌లైన్‌కు కాల్ చేయండి', assistGeneral: 'సాధారణ ఫిర్యాదు హెల్ప్‌లైన్', assistVisit: 'నేరుగా కలవాలనుకుంటున్నారా? మీ గ్రామ/వార్డు సచివాలయ సిబ్బంది కూడా మీకు సహాయం చేస్తారు.',
  },
  ta: {
    noVoiceHint: 'இந்த சாதனத்தில் உங்கள் மொழிக்கான குரல் இல்லை, எனவே கேள்விகளை வாசித்துக் கேட்க முடியாது. அனைத்தும் இயங்கும் — திரையில் உள்ள கேள்விகளைப் படியுங்கள்.',
    navHome: 'முகப்பு', navTrack: 'கண்காணி', navNew: 'புதிய புகார்', navHeatmap: 'ஹீட்மேப்', navAnalytics: 'பகுப்பாய்வு', navConsole: 'கன்சோல்',
    assistDept: 'சம்பந்தப்பட்ட துறை', assistCallDept: 'துறை உதவி எண்ணை அழைக்கவும்', assistGeneral: 'பொது புகார் உதவி எண்', assistVisit: 'நேரில் உதவி வேண்டுமா? உங்கள் கிராம/வார்டு சச்சிவாலயம் ஊழியர்களும் உதவுவார்கள்.',
  },
  kn: {
    noVoiceHint: 'ಈ ಸಾಧನದಲ್ಲಿ ನಿಮ್ಮ ಭಾಷೆಗೆ ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ, ಆದ್ದರಿಂದ ಪ್ರಶ್ನೆಗಳನ್ನು ಓದಿ ಕೇಳಿಸಲಾಗುವುದಿಲ್ಲ. ಎಲ್ಲವೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ — ದಯವಿಟ್ಟು ಪರದೆಯ ಮೇಲಿನ ಪ್ರಶ್ನೆಗಳನ್ನು ಓದಿ.',
    navHome: 'ಮುಖಪುಟ', navTrack: 'ಟ್ರ್ಯಾಕ್', navNew: 'ಹೊಸ ದೂರು', navHeatmap: 'ಹೀಟ್‌ಮ್ಯಾಪ್', navAnalytics: 'ವಿಶ್ಲೇಷಣೆ', navConsole: 'ಕನ್ಸೋಲ್',
    assistDept: 'ಸಂಬಂಧಿತ ಇಲಾಖೆ', assistCallDept: 'ಇಲಾಖೆ ಸಹಾಯವಾಣಿಗೆ ಕರೆ ಮಾಡಿ', assistGeneral: 'ಸಾಮಾನ್ಯ ದೂರು ಸಹಾಯವಾಣಿ', assistVisit: 'ನೇರವಾಗಿ ಭೇಟಿಯಾಗಬೇಕೆ? ನಿಮ್ಮ ಗ್ರಾಮ/ವಾರ್ಡ್ ಸಚಿವಾಲಯದ ಸಿಬ್ಬಂದಿಯೂ ಸಹಾಯ ಮಾಡುತ್ತಾರೆ.',
  },
  ml: {
    noVoiceHint: 'ഈ ഉപകരണത്തിൽ നിങ്ങളുടെ ഭാഷയ്ക്കുള്ള ശബ്ദം ലഭ്യമല്ല, അതിനാൽ ചോദ്യങ്ങൾ വായിച്ചു കേൾപ്പിക്കാൻ കഴിയില്ല. എല്ലാം പ്രവർത്തിക്കും — ദയവായി സ്ക്രീനിലെ ചോദ്യങ്ങൾ വായിക്കുക.',
    navHome: 'ഹോം', navTrack: 'ട്രാക്ക്', navNew: 'പുതിയ പരാതി', navHeatmap: 'ഹീറ്റ്മാപ്പ്', navAnalytics: 'വിശകലനം', navConsole: 'കൺസോൾ',
    assistDept: 'ബന്ധപ്പെട്ട വകുപ്പ്', assistCallDept: 'വകുപ്പ് ഹെല്‍പ്പ്‌ലൈനില്‍ വിളിക്കുക', assistGeneral: 'പൊതു പരാതി ഹെല്‍പ്പ്‌ലൈന്‍', assistVisit: 'നേരിട്ട് സഹായം വേണോ? നിങ്ങളുടെ ഗ്രാമ/വാര്‍ഡ് സച്ചിവാലയ ജീവനക്കാരും സഹായിക്കും.',
  },
  bn: {
    noVoiceHint: 'এই ডিভাইসে আপনার ভাষার কণ্ঠস্বর নেই, তাই প্রশ্নগুলি পড়ে শোনানো যাবে না। সবকিছু কাজ করবে — অনুগ্রহ করে স্ক্রিনে প্রশ্নগুলি পড়ুন।',
    navHome: 'হোম', navTrack: 'ট্র্যাক', navNew: 'নতুন অভিযোগ', navHeatmap: 'হিটম্যাপ', navAnalytics: 'বিশ্লেষণ', navConsole: 'কনসোল',
    assistDept: 'সংশ্লিষ্ট বিভাগ', assistCallDept: 'বিভাগের হেল্পলাইনে কল করুন', assistGeneral: 'সাধারণ অভিযোগ হেল্পলাইন', assistVisit: 'সরাসরি সাহায্য চান? আপনার গ্রাম/ওয়ার্ড সচিবালয়ের কর্মীরাও সাহায্য করবেন।',
  },
  mr: {
    noVoiceHint: 'या डिव्हाइसवर तुमच्या भाषेसाठी आवाज उपलब्ध नाही, त्यामुळे प्रश्न वाचून ऐकवता येणार नाहीत. सर्व काही चालू आहे — कृपया स्क्रीनवरील प्रश्न वाचा.',
    navHome: 'होम', navTrack: 'ट्रॅक', navNew: 'नवीन तक्रार', navHeatmap: 'हीटमॅप', navAnalytics: 'विश्लेषण', navConsole: 'कन्सोल',
    assistDept: 'संबंधित विभाग', assistCallDept: 'विभाग हेल्पलाइनवर कॉल करा', assistGeneral: 'सर्वसाधारण तक्रार हेल्पलाइन', assistVisit: 'प्रत्यक्ष मदत हवी? तुमच्या ग्राम/वॉर्ड सचिवालयातील कर्मचारीही मदत करतील.',
  },
  gu: {
    noVoiceHint: 'આ ડિવાઇસ પર તમારી ભાષા માટે અવાજ ઉપલબ્ધ નથી, તેથી પ્રશ્નો વાંચી સંભળાવી શકાશે નહીં. બધું કામ કરે છે — કૃપા કરીને સ્ક્રીન પરના પ્રશ્નો વાંચો.',
    navHome: 'હોમ', navTrack: 'ટ્રૅક', navNew: 'નવી ફરિયાદ', navHeatmap: 'હીટમેપ', navAnalytics: 'વિશ્લેષણ', navConsole: 'કન્સોલ',
    assistDept: 'સંબંધિત વિભાગ', assistCallDept: 'વિભાગ હેલ્પલાઇન પર કૉલ કરો', assistGeneral: 'સામાન્ય ફરિયાદ હેલ્પલાઇન', assistVisit: 'રૂબરૂ મદદ જોઈએ છે? તમારા ગ્રામ/વોર્ડ સચિવાલયના કર્મચારીઓ પણ મદદ કરશે.',
  },
  pa: {
    noVoiceHint: 'ਇਸ ਡਿਵਾਈਸ ਉੱਤੇ ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਲਈ ਆਵਾਜ਼ ਉਪਲਬਧ ਨਹੀਂ ਹੈ, ਇਸ ਲਈ ਸਵਾਲ ਪੜ੍ਹ ਕੇ ਸੁਣਾਏ ਨਹੀਂ ਜਾ ਸਕਦੇ। ਸਭ ਕੁਝ ਕੰਮ ਕਰਦਾ ਹੈ — ਕਿਰਪਾ ਕਰਕੇ ਸਕ੍ਰੀਨ ਉੱਤੇ ਸਵਾਲ ਪੜ੍ਹੋ।',
    navHome: 'ਹੋਮ', navTrack: 'ਟ੍ਰੈਕ', navNew: 'ਨਵੀਂ ਸ਼ਿਕਾਇਤ', navHeatmap: 'ਹੀਟਮੈਪ', navAnalytics: 'ਵਿਸ਼ਲੇਸ਼ਣ', navConsole: 'ਕੰਸੋਲ',
    assistDept: 'ਸੰਬੰਧਿਤ ਵਿਭਾਗ', assistCallDept: 'ਵਿਭਾਗ ਹੈਲਪਲਾਈਨ ਤੇ ਕਾਲ ਕਰੋ', assistGeneral: 'ਆਮ ਸ਼ਿਕਾਇਤ ਹੈਲਪਲਾਈਨ', assistVisit: 'ਸਿੱਧੀ ਮਦਦ ਚਾਹੀਦੀ ਹੈ? ਤੁਹਾਡੇ ਗ੍ਰਾਮ/ਵਾਰਡ ਸਚਿਵਾਲਿਆ ਦੇ ਕਰਮਚਾਰੀ ਵੀ ਮਦਦ ਕਰਨਗੇ।',
  },
  or: {
    noVoiceHint: 'ଏହି ଡିଭାଇସରେ ଆପଣଙ୍କ ଭାଷା ପାଇଁ ସ୍ୱର ଉପଲବ୍ଧ ନାହିଁ, ତେଣୁ ପ୍ରଶ୍ନଗୁଡ଼ିକ ପଢ଼ି ଶୁଣାଯାଇ ପାରିବ ନାହିଁ। ସବୁକିଛି କାମ କରେ — ଦୟାକରି ସ୍କ୍ରିନରେ ପ୍ରଶ୍ନଗୁଡ଼ିକ ପଢ଼ନ୍ତୁ।',
    navHome: 'ହୋମ', navTrack: 'ଟ୍ରାକ୍', navNew: 'ନୂଆ ଅଭିଯୋଗ', navHeatmap: 'ହିଟମ୍ୟାପ୍', navAnalytics: 'ବିଶ୍ଳେଷଣ', navConsole: 'କନସୋଲ',
    assistDept: 'ସମ୍ପୃକ୍ତ ବିଭାଗ', assistCallDept: 'ବିଭାଗ ହେଲ୍ପଲାଇନକୁ କଲ୍ କରନ୍ତୁ', assistGeneral: 'ସାଧାରଣ ଅଭିଯୋଗ ହେଲ୍ପଲାଇନ', assistVisit: 'ସିଧାସଳଖ ସାହାଯ୍ୟ ଦରକାର? ଆପଣଙ୍କ ଗ୍ରାମ/ୱାର୍ଡ ସଚିବାଳୟର କର୍ମଚାରୀ ମଧ୍ୟ ସାହାଯ୍ୟ କରିବେ।',
  },
  ur: {
    noVoiceHint: 'اس آلے پر آپ کی زبان کے لیے آواز دستیاب نہیں ہے، اس لیے سوالات پڑھ کر سنائے نہیں جا سکتے۔ سب کچھ کام کرتا ہے — براہ کرم اسکرین پر سوالات پڑھیں۔',
    navHome: 'ہوم', navTrack: 'ٹریک', navNew: 'نئی شکایت', navHeatmap: 'ہیٹ میپ', navAnalytics: 'تجزیہ', navConsole: 'کنسول',
    assistDept: 'متعلقہ محکمہ', assistCallDept: 'محکمہ ہیلپ لائن پر کال کریں', assistGeneral: 'عمومی شکایت ہیلپ لائن', assistVisit: 'بالمشافہ مدد چاہیے؟ آپ کے گرام/وارڈ سچیوالیہ کا عملہ بھی مدد کرے گا۔',
  },
};

export const translations: Record<string, Dict> = { en, ...generated };
for (const [code, patch] of Object.entries(extras)) {
  translations[code] = { ...(translations[code] ?? {}), ...patch };
}
