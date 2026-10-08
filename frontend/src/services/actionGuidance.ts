/**
 * PREVENT — Phase 4: Deterministic Multilingual Action Guidance Engine
 * 
 * CORE PRODUCT PRINCIPLE:
 * PREVENT is a domain-agnostic safety intelligence platform.
 * Safety actions are deterministic, explainable, and generic:
 * - LOW      -> Monitor
 * - MEDIUM   -> Inspect
 * - HIGH     -> Inspect + Escalate
 * - CRITICAL -> Isolate + Escalate
 * 
 * Flow: EVIDENCE -> WHY NOW -> WHAT NEXT (Action) -> HUMAN DECISION
 * 
 * Supported Action Languages:
 * - English ('en')
 * - Tamil ('ta' - தமிழ்)
 * - Hindi ('hi' - हिन्दी)
 * 
 * Offline, zero-LLM deterministic translation dictionary with role-aware nuances.
 */

import type { RiskLevel } from '../types/api';

export type ActionLanguage = 'en' | 'ta' | 'hi';
export type ActionRole = 'general' | 'field_worker' | 'supervisor' | 'safety_officer';
export type ActionCategory = 'MONITOR' | 'INSPECT' | 'INSPECT_ESCALATE' | 'ISOLATE_ESCALATE';

export interface ActionGuidance {
  category: ActionCategory;
  title: string;
  headerTag: string;
  instruction: string;
  detail: string;
  roleInstruction: string;
  language: ActionLanguage;
  role: ActionRole;
}

export interface ActionTranslationDictionary {
  headerTag: string;
  languageName: string;
  categories: {
    MONITOR: {
      title: string;
      instruction: string;
      detail: string;
      roles: Record<ActionRole, string>;
    };
    INSPECT: {
      title: string;
      instruction: string;
      detail: string;
      roles: Record<ActionRole, string>;
    };
    INSPECT_ESCALATE: {
      title: string;
      instruction: string;
      detail: string;
      roles: Record<ActionRole, string>;
    };
    ISOLATE_ESCALATE: {
      title: string;
      instruction: string;
      detail: string;
      roles: Record<ActionRole, string>;
    };
  };
  ui: {
    languageSelectorLabel: string;
    roleSelectorLabel: string;
    roles: Record<ActionRole, string>;
    humanDecisionTitle: string;
    acceptButton: string;
    chooseDifferentButton: string;
    dismissButton: string;
    changeDecisionButton: string;
    decisionAccepted: string;
    decisionCustom: string;
    decisionDismissed: string;
    customActionPlaceholder: string;
    customOptions: {
      scheduleDetailed: string;
      placeWatchlist: string;
      requestReassessment: string;
      verifyContinuedOperation: string;
    };
    disclaimer: string;
  };
}

export const ACTION_TRANSLATIONS: Record<ActionLanguage, ActionTranslationDictionary> = {
  en: {
    headerTag: 'RECOMMENDED NEXT STEP',
    languageName: 'English',
    categories: {
      MONITOR: {
        title: 'Monitor',
        instruction: 'Continue routine observation.',
        detail: 'Maintain standard scheduled operational observation. No immediate intervention required.',
        roles: {
          general: 'Continue routine observation.',
          field_worker: 'Continue routine observation and log any abnormal behavior during normal shifts.',
          supervisor: 'Keep asset under standard surveillance baseline.',
          safety_officer: 'Routine surveillance confirmed. No active escalations needed.'
        }
      },
      INSPECT: {
        title: 'Inspect',
        instruction: 'Review the affected subsystem and check for recurring warning signals.',
        detail: 'Perform a non-intrusive operational check and compare with recent shift logs to detect recurring patterns.',
        roles: {
          general: 'Review the affected subsystem and check for recurring warning signals.',
          field_worker: 'Inspect the affected subsystem during next turnaround and record observations.',
          supervisor: 'Review the evidence and assign a focused subsystem inspection.',
          safety_officer: 'Track converging signals and verify recent maintenance logs.'
        }
      },
      INSPECT_ESCALATE: {
        title: 'Inspect + Escalate',
        instruction: 'Perform a focused inspection and notify the responsible safety/maintenance team before normal operation continues.',
        detail: 'Elevated multi-source signals indicate accelerating risk. Human verification required prior to continued dispatch.',
        roles: {
          general: 'Perform a focused inspection and notify the responsible safety/maintenance team before normal operation continues.',
          field_worker: 'Perform a focused inspection of the affected subsystem and immediately report findings to supervisor.',
          supervisor: 'Review the converging evidence and assign an urgent certified inspection before next operational cycle.',
          safety_officer: 'Review the converging signals and escalate according to established safety procedure.'
        }
      },
      ISOLATE_ESCALATE: {
        title: 'Isolate + Escalate',
        instruction: 'Do not return the affected asset to normal operation until the responsible team has inspected and verified it.',
        detail: 'Immediate human safety intervention required. Quarantine asset from active duty until safety certification is verified.',
        roles: {
          general: 'Do not return the affected asset to normal operation until the responsible team has inspected and verified it.',
          field_worker: 'Hold asset in place, do not dispatch, and immediately contact safety dispatch.',
          supervisor: 'Withhold asset from active operations and coordinate emergency teardown inspection.',
          safety_officer: 'Issue safety isolation directive and require full recertification prior to release.'
        }
      }
    },
    ui: {
      languageSelectorLabel: 'Action language',
      roleSelectorLabel: 'Perspective',
      roles: {
        general: 'Standard',
        field_worker: 'Field Worker',
        supervisor: 'Supervisor',
        safety_officer: 'Safety Officer'
      },
      humanDecisionTitle: 'HUMAN DECISION RECORD',
      acceptButton: 'Accept Recommendation',
      chooseDifferentButton: 'Choose Different Action',
      dismissButton: 'Dismiss',
      changeDecisionButton: 'Change Decision',
      decisionAccepted: 'Decision Recorded: Accepted by Safety Operator',
      decisionCustom: 'Decision Recorded: Custom Action Selected',
      decisionDismissed: 'Decision Recorded: Dismissed with Operator Justification',
      customActionPlaceholder: 'Select alternative operational action...',
      customOptions: {
        scheduleDetailed: 'Schedule Detailed Inspection Protocol',
        placeWatchlist: 'Place on Heightened Telematics Watchlist',
        requestReassessment: 'Request Specialist Verification Review',
        verifyContinuedOperation: 'Verified Safe for Continued Operation'
      },
      disclaimer: 'PREVENT provides deterministic decision support. Final operational decisions rest with the responsible human authority.'
    }
  },

  ta: {
    headerTag: 'பரிந்துரைக்கப்படும் அடுத்த நடவடிக்கை',
    languageName: 'தமிழ்',
    categories: {
      MONITOR: {
        title: 'கண்காணிப்பு',
        instruction: 'வழக்கமான செயல்பாட்டுக் கண்காணிப்பைத் தொடரவும்.',
        detail: 'நிலையான அட்டவணைப்படி வழக்கமான செயல்பாட்டுக் கண்காணிப்பைத் தொடரவும். உடனடி தலையீடு தேவையில்லை.',
        roles: {
          general: 'வழக்கமான செயல்பாட்டுக் கண்காணிப்பைத் தொடரவும்.',
          field_worker: 'வழக்கமான கண்காணிப்பைத் தொடரவும்; ஏதேனும் அசாதாரணங்கள் இருந்தால் பதிவு செய்யவும்.',
          supervisor: 'சொத்தை நிலையான கண்காணிப்பு வரம்பில் வைத்திருக்கவும்.',
          safety_officer: 'வழக்கமான கண்காணிப்பு உறுதிப்படுத்தப்பட்டது. கூடுதல் நடவடிக்கைகள் தேவையில்லை.'
        }
      },
      INSPECT: {
        title: 'ஆய்வு',
        instruction: 'பாதிக்கப்பட்ட அமைப்பை மதிப்பாய்வு செய்து மீண்டும் மீண்டும் வரும் எச்சரிக்கை சமிக்ஞைகளை சரிபார்க்கவும்.',
        detail: 'பாதிக்கப்பட்ட அமைப்பை ஆய்வு செய்து முந்தைய பதிவுகளுடன் ஒப்பிட்டு சாத்தியமான குறைபாடுகளைக் கண்டறியவும்.',
        roles: {
          general: 'பாதிக்கப்பட்ட அமைப்பை மதிப்பாய்வு செய்து மீண்டும் மீண்டும் வரும் எச்சரிக்கை சமிக்ஞைகளை சரிபார்க்கவும்.',
          field_worker: 'அடுத்த சுழற்சியில் பாதிக்கப்பட்ட அமைப்பை ஆய்வு செய்து முடிவுகளைப் பதிவு செய்யவும்.',
          supervisor: 'ஆதாரங்களை மதிப்பாய்வு செய்து கவனம் செலுத்தப்பட்ட ஆய்வை ஒதுக்கீடு செய்யவும்.',
          safety_officer: 'ஒன்றிணையும் சமிக்ஞைகளைக் கண்காணித்து பராமரிப்பு பதிவுகளை சரிபார்க்கவும்.'
        }
      },
      INSPECT_ESCALATE: {
        title: 'ஆய்வு + மேலதிகாரிக்கு தகவல்',
        instruction: 'வழக்கமான செயல்பாட்டைத் தொடர்வதற்கு முன், பாதிக்கப்பட்ட அமைப்பை முழுமையாக ஆய்வு செய்து பொறுப்பான பாதுகாப்புக் குழுவிற்கு தகவல் தெரிவிக்கவும்.',
        detail: 'பல்வேறு மூலங்களிலிருந்து வரும் எச்சரிக்கைகள் ஆபத்து அதிகரிப்பதைக் காட்டுகின்றன. செயல்பாட்டைத் தொடரும் முன் மனித சரிபார்ப்பு அவசியம்.',
        roles: {
          general: 'வழக்கமான செயல்பாட்டைத் தொடர்வதற்கு முன், பாதிக்கப்பட்ட அமைப்பை முழுமையாக ஆய்வு செய்து பொறுப்பான பாதுகாப்புக் குழுவிற்கு தகவல் தெரிவிக்கவும்.',
          field_worker: 'பாதிக்கப்பட்ட அமைப்பை விரிவாக ஆய்வு செய்து மேற்பார்வையாளரிடம் உடனடியாக அறிக்கை சமர்ப்பிக்கவும்.',
          supervisor: 'ஆதாரங்களை மதிப்பாய்வு செய்து அடுத்த இயக்கத்திற்கு முன் அவசர ஆய்வை ஒதுக்கீடு செய்யவும்.',
          safety_officer: 'பாதுகாப்பு நெறிமுறைகளின்படி சமிக்ஞைகளை மதிப்பாய்வு செய்து மேலதிக நடவடிக்கை எடுக்கவும்.'
        }
      },
      ISOLATE_ESCALATE: {
        title: 'தனிமைப்படுத்துதல் + அவசர தகவல்',
        instruction: 'பொறுப்பான பாதுகாப்புக் குழு ஆய்வு செய்து உறுதிப்படுத்தும் வரை பாதிக்கப்பட்ட சொத்தை வழக்கமான செயல்பாட்டிற்கு அனுமதிக்க வேண்டாம்.',
        detail: 'உடனடி மனித பாதுகாப்பு தலையீடு தேவை. பாதுகாப்புக் குழு ஆய்வு செய்து சான்றளிக்கும் வரை சொத்தை செயல்பாட்டிலிருந்து விலக்கி வைக்கவும்.',
        roles: {
          general: 'பொறுப்பான பாதுகாப்புக் குழு ஆய்வு செய்து உறுதிப்படுத்தும் வரை பாதிக்கப்பட்ட சொத்தை வழக்கமான செயல்பாட்டிற்கு அனுமதிக்க வேண்டாம்.',
          field_worker: 'சொத்தை உடனடியாக நிறுத்தி வைக்கவும்; பணியில் ஈடுபடுத்தாமல் பாதுகாப்புக் கட்டுப்பாட்டு அறைக்கு தகவல் தெரிவிக்கவும்.',
          supervisor: 'சொத்தை செயல்பாட்டிலிருந்து உடனடியாக விலக்கி, அவசர விரிவான ஆய்வுக் குழுவை ஒருங்கிணைக்கவும்.',
          safety_officer: 'பாதுகாப்பு தனிமைப்படுத்தல் உத்தரவைப் பிறப்பித்து, மறுசான்றளிப்பு முடியும் வரை விடுவிக்க வேண்டாம்.'
        }
      }
    },
    ui: {
      languageSelectorLabel: 'நடவடிக்கை மொழி',
      roleSelectorLabel: 'பார்வை நிலை',
      roles: {
        general: 'பொதுவானது',
        field_worker: 'களப் பணியாளர்',
        supervisor: 'மேற்பார்வையாளர்',
        safety_officer: 'பாதுகாப்பு அதிகாரி'
      },
      humanDecisionTitle: 'மனித முடிவுப் பதிவு',
      acceptButton: 'பரிந்துரையை ஏற்கவும்',
      chooseDifferentButton: 'வேறு நடவடிக்கையைத் தேர்ந்தெடுக்கவும்',
      dismissButton: 'நிராகரி',
      changeDecisionButton: 'முடிவை மாற்றவும்',
      decisionAccepted: 'முடிவு பதிவு செய்யப்பட்டது: பாதுகாப்பு அதிகாரியால் ஏற்றுக்கொள்ளப்பட்டது',
      decisionCustom: 'முடிவு பதிவு செய்யப்பட்டது: தனிப்பயன் நடவடிக்கை தேர்ந்தெடுக்கப்பட்டது',
      decisionDismissed: 'முடிவு பதிவு செய்யப்பட்டது: அதிகாரியின் காரணத்துடன் நிராகரிக்கப்பட்டது',
      customActionPlaceholder: 'மாற்று செயல்பாட்டு நடவடிக்கையைத் தேர்ந்தெடுக்கவும்...',
      customOptions: {
        scheduleDetailed: 'விரிவான ஆய்வு நெறிமுறையைத் திட்டமிடுங்கள்',
        placeWatchlist: 'தீவிர கண்காணிப்புப் பட்டியலில் சேர்க்கவும்',
        requestReassessment: 'நிபுணர் மறுமதிப்பீட்டைக் கோருங்கள்',
        verifyContinuedOperation: 'தொடர்ந்து செயல்பட பாதுகாப்பானது என சரிபார்க்கப்பட்டது'
      },
      disclaimer: 'PREVENT திட்டவட்டமான முடிவு ஆதரவை மட்டுமே வழங்குகிறது. இறுதி செயல்பாட்டு முடிவு பொறுப்பான மனித அதிகாரியையே சார்ந்துள்ளது.'
    }
  },

  hi: {
    headerTag: 'अनुशंसित अगला कदम',
    languageName: 'हिन्दी',
    categories: {
      MONITOR: {
        title: 'निगरानी रखें',
        instruction: 'नियमित अवलोकन जारी रखें।',
        detail: 'मानक निर्धारित परिचालन अवलोकन जारी रखें। तत्काल किसी हस्तक्षेप की आवश्यकता नहीं है।',
        roles: {
          general: 'नियमित अवलोकन जारी रखें।',
          field_worker: 'नियमित अवलोकन जारी रखें और सामान्य पारियों के दौरान किसी भी असामान्य स्थिति को दर्ज करें।',
          supervisor: 'उपकरण को सामान्य निगरानी स्तर पर बनाए रखें।',
          safety_officer: 'नियमित निगरानी की पुष्टि की गई। किसी सक्रिय वृद्धि की आवश्यकता नहीं है।'
        }
      },
      INSPECT: {
        title: 'जाँच करें',
        instruction: 'प्रभावित प्रणाली की समीक्षा करें और आवर्ती चेतावनी संकेतों की जाँच करें।',
        detail: 'प्रभावित उपप्रणाली की जाँच करें और संभावित दोषों की पहचान के लिए हालिया रिपोर्टों से मिलान करें।',
        roles: {
          general: 'प्रभावित प्रणाली की समीक्षा करें और आवर्ती चेतावनी संकेतों की जाँच करें।',
          field_worker: 'अगले चक्र में प्रभावित प्रणाली की जाँच करें और अवलोकनों को दर्ज करें।',
          supervisor: 'सबूतों की समीक्षा करें और लक्षित उपप्रणाली निरीक्षण सौंपें।',
          safety_officer: 'अभिसरित संकेतों को ट्रैक करें और हालिया रखरखाव लॉग का सत्यापन करें।'
        }
      },
      INSPECT_ESCALATE: {
        title: 'जाँच + सूचना दें',
        instruction: 'सामान्य संचालन जारी रखने से पहले प्रभावित प्रणाली की जाँच करें और जिम्मेदार सुरक्षा टीम को सूचित करें।',
        detail: 'कई स्रोतों से प्राप्त संकेत बढ़ते जोखिम का संकेत देते हैं। आगे संचालन से पहले मानव सत्यापन अनिवार्य है।',
        roles: {
          general: 'सामान्य संचालन जारी रखने से पहले प्रभावित प्रणाली की जाँच करें और जिम्मेदार सुरक्षा टीम को सूचित करें।',
          field_worker: 'प्रभावित प्रणाली का गहन निरीक्षण करें और तुरंत अपने पर्यवेक्षक को सूचित करें।',
          supervisor: 'अगले परिचालन चक्र से पहले आपातकालीन प्रमाणित निरीक्षण का निर्देश दें।',
          safety_officer: 'संकेतों की समीक्षा करें और स्थापित सुरक्षा प्रक्रिया के अनुसार कार्रवाई बढ़ाएं।'
        }
      },
      ISOLATE_ESCALATE: {
        title: 'अलग करें + तत्काल सूचना दें',
        instruction: 'जब तक जिम्मेदार सुरक्षा टीम जाँच और सत्यापन न कर ले, तब तक प्रभावित उपकरण को सामान्य संचालन में वापस न लाएं।',
        detail: 'तत्काल मानव सुरक्षा हस्तक्षेप आवश्यक है। सुरक्षा दल द्वारा प्रमाणित किए जाने तक उपकरण को संचालन से अलग रखें।',
        roles: {
          general: 'जब तक जिम्मेदार सुरक्षा टीम जाँच और सत्यापन न कर ले, तब तक प्रभावित उपकरण को सामान्य संचालन में वापस न लाएं।',
          field_worker: 'उपकरण को तुरंत रोकें, ड्यूटी में न लगाएं और तत्काल सुरक्षा नियंत्रण को सूचित करें।',
          supervisor: 'उपकरण को संचालन से बाहर रखें और आपातकालीन तकनीकी निरीक्षण का समन्वय करें।',
          safety_officer: 'सुरक्षा अलगाव का निर्देश जारी करें और पुनर्प्रमाणीकरण सुनिश्चित करें।'
        }
      }
    },
    ui: {
      languageSelectorLabel: 'कार्रवाई की भाषा',
      roleSelectorLabel: 'दृष्टिकोण',
      roles: {
        general: 'मानक',
        field_worker: 'फील्ड कार्यकर्ता',
        supervisor: 'पर्यवेक्षक',
        safety_officer: 'सुरक्षा अधिकारी'
      },
      humanDecisionTitle: 'मानव निर्णय रिकॉर्ड',
      acceptButton: 'सिफारिश स्वीकार करें',
      chooseDifferentButton: 'अन्य कार्रवाई चुनें',
      dismissButton: 'खारिज करें',
      changeDecisionButton: 'निर्णय बदलें',
      decisionAccepted: 'निर्णय दर्ज: सुरक्षा अधिकारी द्वारा स्वीकृत',
      decisionCustom: 'निर्णय दर्ज: विशेष कार्रवाई चुनी गई',
      decisionDismissed: 'निर्णय दर्ज: ऑपरेटर के औचित्य के साथ खारिज',
      customActionPlaceholder: 'वैकल्पिक परिचालन कार्रवाई चुनें...',
      customOptions: {
        scheduleDetailed: 'विस्तृत निरीक्षण प्रोटोकॉल निर्धारित करें',
        placeWatchlist: 'सघन टेलीमैटिक्स निगरानी सूची में रखें',
        requestReassessment: 'विशेषज्ञ समीक्षा का अनुरोध करें',
        verifyContinuedOperation: 'निरंतर संचालन के लिए सुरक्षित सत्यापित'
      },
      disclaimer: 'PREVENT केवल निर्णयात्मक सहायता प्रदान करता है। अंतिम परिचालन निर्णय जिम्मेदार मानव प्राधिकारी के पास है।'
    }
  }
};

/**
 * Deterministically map a canonical RiskLevel to an ActionCategory.
 */
export function getActionCategoryForRiskLevel(riskLevel: RiskLevel | string): ActionCategory {
  const norm = (riskLevel || '').toUpperCase();
  switch (norm) {
    case 'CRITICAL':
      return 'ISOLATE_ESCALATE';
    case 'HIGH':
      return 'INSPECT_ESCALATE';
    case 'MEDIUM':
      return 'INSPECT';
    case 'LOW':
    default:
      return 'MONITOR';
  }
}

/**
 * Deterministically resolve complete action guidance based on risk level, language, and role.
 * Fallback is guaranteed to be clean English without throwing errors.
 */
export function getRecommendedAction(
  riskLevel: RiskLevel | string,
  language: ActionLanguage = 'en',
  role: ActionRole = 'general'
): ActionGuidance {
  const validLang: ActionLanguage = ['en', 'ta', 'hi'].includes(language) ? language : 'en';
  const validRole: ActionRole = ['general', 'field_worker', 'supervisor', 'safety_officer'].includes(role)
    ? role
    : 'general';

  const category = getActionCategoryForRiskLevel(riskLevel);
  const dict = ACTION_TRANSLATIONS[validLang] || ACTION_TRANSLATIONS.en;
  const catData = dict.categories[category] || ACTION_TRANSLATIONS.en.categories[category];

  const roleInstruction =
    catData.roles[validRole] || catData.roles.general || catData.instruction;

  return {
    category,
    title: catData.title,
    headerTag: dict.headerTag,
    instruction: catData.instruction,
    detail: catData.detail,
    roleInstruction,
    language: validLang,
    role: validRole
  };
}

/**
 * Get UI dictionary for a given language.
 */
export function getActionUiDictionary(language: ActionLanguage = 'en') {
  const validLang: ActionLanguage = ['en', 'ta', 'hi'].includes(language) ? language : 'en';
  return (ACTION_TRANSLATIONS[validLang] || ACTION_TRANSLATIONS.en).ui;
}
