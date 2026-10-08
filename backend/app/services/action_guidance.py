"""
PREVENT — Phase 4: Deterministic Multilingual Action Guidance Engine

CORE PRODUCT PRINCIPLE:
PREVENT is a domain-agnostic safety intelligence platform.
Action recommendations are deterministic, explainable, and generic:
- LOW      -> Monitor
- MEDIUM   -> Inspect
- HIGH     -> Inspect + Escalate
- CRITICAL -> Isolate + Escalate

Offline, zero-LLM deterministic translation dictionary with role-aware nuances.
"""

from typing import Dict, Any

ACTION_TRANSLATIONS: Dict[str, Dict[str, Any]] = {
    "en": {
        "header_tag": "RECOMMENDED NEXT STEP",
        "language_name": "English",
        "categories": {
            "MONITOR": {
                "title": "Monitor",
                "instruction": "Continue routine observation.",
                "detail": "Maintain standard scheduled operational observation. No immediate intervention required.",
                "roles": {
                    "general": "Continue routine observation.",
                    "field_worker": "Continue routine observation and log any abnormal behavior during normal shifts.",
                    "supervisor": "Keep asset under standard surveillance baseline.",
                    "safety_officer": "Routine surveillance confirmed. No active escalations needed."
                }
            },
            "INSPECT": {
                "title": "Inspect",
                "instruction": "Review the affected subsystem and check for recurring warning signals.",
                "detail": "Perform a non-intrusive operational check and compare with recent shift logs to detect recurring patterns.",
                "roles": {
                    "general": "Review the affected subsystem and check for recurring warning signals.",
                    "field_worker": "Inspect the affected subsystem during next turnaround and record observations.",
                    "supervisor": "Review the evidence and assign a focused subsystem inspection.",
                    "safety_officer": "Track converging signals and verify recent maintenance logs."
                }
            },
            "INSPECT_ESCALATE": {
                "title": "Inspect + Escalate",
                "instruction": "Perform a focused inspection and notify the responsible safety/maintenance team before normal operation continues.",
                "detail": "Elevated multi-source signals indicate accelerating risk. Human verification required prior to continued dispatch.",
                "roles": {
                    "general": "Perform a focused inspection and notify the responsible safety/maintenance team before normal operation continues.",
                    "field_worker": "Perform a focused inspection of the affected subsystem and immediately report findings to supervisor.",
                    "supervisor": "Review the converging evidence and assign an urgent certified inspection before next operational cycle.",
                    "safety_officer": "Review the converging signals and escalate according to established safety procedure."
                }
            },
            "ISOLATE_ESCALATE": {
                "title": "Isolate + Escalate",
                "instruction": "Do not return the affected asset to normal operation until the responsible team has inspected and verified it.",
                "detail": "Immediate human safety intervention required. Quarantine asset from active duty until safety certification is verified.",
                "roles": {
                    "general": "Do not return the affected asset to normal operation until the responsible team has inspected and verified it.",
                    "field_worker": "Hold asset in place, do not dispatch, and immediately contact safety dispatch.",
                    "supervisor": "Withhold asset from active operations and coordinate emergency teardown inspection.",
                    "safety_officer": "Issue safety isolation directive and require full recertification prior to release."
                }
            }
        }
    },
    "ta": {
        "header_tag": "பரிந்துரைக்கப்படும் அடுத்த நடவடிக்கை",
        "language_name": "தமிழ்",
        "categories": {
            "MONITOR": {
                "title": "கண்காணிப்பு",
                "instruction": "வழக்கமான செயல்பாட்டுக் கண்காணிப்பைத் தொடரவும்.",
                "detail": "நிலையான அட்டவணைப்படி வழக்கமான செயல்பாட்டுக் கண்காணிப்பைத் தொடரவும். உடனடி தலையீடு தேவையில்லை.",
                "roles": {
                    "general": "வழக்கமான செயல்பாட்டுக் கண்காணிப்பைத் தொடரவும்.",
                    "field_worker": "வழக்கமான கண்காணிப்பைத் தொடரவும்; ஏதேனும் அசாதாரணங்கள் இருந்தால் பதிவு செய்யவும்.",
                    "supervisor": "சொத்தை நிலையான கண்காணிப்பு வரம்பில் வைத்திருக்கவும்.",
                    "safety_officer": "வழக்கமான கண்காணிப்பு உறுதிப்படுத்தப்பட்டது. கூடுதல் நடவடிக்கைகள் தேவையில்லை."
                }
            },
            "INSPECT": {
                "title": "ஆய்வு",
                "instruction": "பாதிக்கப்பட்ட அமைப்பை மதிப்பாய்வு செய்து மீண்டும் மீண்டும் வரும் எச்சரிக்கை சமிக்ஞைகளை சரிபார்க்கவும்.",
                "detail": "பாதிக்கப்பட்ட அமைப்பை ஆய்வு செய்து முந்தைய பதிவுகளுடன் ஒப்பிட்டு சாத்தியமான குறைபாடுகளைக் கண்டறியவும்.",
                "roles": {
                    "general": "பாதிக்கப்பட்ட அமைப்பை மதிப்பாய்வு செய்து மீண்டும் மீண்டும் வரும் எச்சரிக்கை சமிக்ஞைகளை சரிபார்க்கவும்.",
                    "field_worker": "அடுத்த சுழற்சியில் பாதிக்கப்பட்ட அமைப்பை ஆய்வு செய்து முடிவுகளைப் பதிவு செய்யவும்.",
                    "supervisor": "ஆதாரங்களை மதிப்பாய்வு செய்து கவனம் செலுத்தப்பட்ட ஆய்வை ஒதுக்கீடு செய்யவும்.",
                    "safety_officer": "ஒன்றிணையும் சமிக்ஞைகளைக் கண்காணித்து பராமரிப்பு பதிவுகளை சரிபார்க்கவும்."
                }
            },
            "INSPECT_ESCALATE": {
                "title": "ஆய்வு + மேலதிகாரிக்கு தகவல்",
                "instruction": "வழக்கமான செயல்பாட்டைத் தொடர்வதற்கு முன், பாதிக்கப்பட்ட அமைப்பை முழுமையாக ஆய்வு செய்து பொறுப்பான பாதுகாப்புக் குழுவிற்கு தகவல் தெரிவிக்கவும்.",
                "detail": "பல்வேறு மூலங்களிலிருந்து வரும் எச்சரிக்கைகள் ஆபத்து அதிகரிப்பதைக் காட்டுகின்றன. செயல்பாட்டைத் தொடரும் முன் மனித சரிபார்ப்பு அவசியம்.",
                "roles": {
                    "general": "வழக்கமான செயல்பாட்டைத் தொடர்வதற்கு முன், பாதிக்கப்பட்ட அமைப்பை முழுமையாக ஆய்வு செய்து பொறுப்பான பாதுகாப்புக் குழுவிற்கு தகவல் தெரிவிக்கவும்.",
                    "field_worker": "பாதிக்கப்பட்ட அமைப்பை விரிவாக ஆய்வு செய்து மேற்பார்வையாளரிடம் உடனடியாக அறிக்கை சமர்ப்பிக்கவும்.",
                    "supervisor": "ஆதாரங்களை மதிப்பாய்வு செய்து அடுத்த இயக்கத்திற்கு முன் அவசர ஆய்வை ஒதுக்கீடு செய்யவும்.",
                    "safety_officer": "பாதுகாப்பு நெறிமுறைகளின்படி சமிக்ஞைகளை மதிப்பாய்வு செய்து மேலதிக நடவடிக்கை எடுக்கவும்."
                }
            },
            "ISOLATE_ESCALATE": {
                "title": "தனிமைப்படுத்துதல் + அவசர தகவல்",
                "instruction": "பொறுப்பான பாதுகாப்புக் குழு ஆய்வு செய்து உறுதிப்படுத்தும் வரை பாதிக்கப்பட்ட சொத்தை வழக்கமான செயல்பாட்டிற்கு அனுமதிக்க வேண்டாம்.",
                "detail": "உடனடி மனித பாதுகாப்பு தலையீடு தேவை. பாதுகாப்புக் குழு ஆய்வு செய்து சான்றளிக்கும் வரை சொத்தை செயல்பாட்டிலிருந்து விலக்கி வைக்கவும்.",
                "roles": {
                    "general": "பொறுப்பான பாதுகாப்புக் குழு ஆய்வு செய்து உறுதிப்படுத்தும் வரை பாதிக்கப்பட்ட சொத்தை வழக்கமான செயல்பாட்டிற்கு அனுமதிக்க வேண்டாம்.",
                    "field_worker": "சொத்தை உடனடியாக நிறுத்தி வைக்கவும்; பணியில் ஈடுபடுத்தாமல் பாதுகாப்புக் கட்டுப்பாட்டு அறைக்கு தகவல் தெரிவிக்கவும்.",
                    "supervisor": "சொத்தை செயல்பாட்டிலிருந்து உடனடியாக விலக்கி, அவசர விரிவான ஆய்வுக் குழுவை ஒருங்கிணைக்கவும்.",
                    "safety_officer": "பாதுகாப்பு தனிமைப்படுத்தல் உத்தரவைப் பிறப்பித்து, மறுசான்றளிப்பு முடியும் வரை விடுவிக்க வேண்டாம்."
                }
            }
        }
    },
    "hi": {
        "header_tag": "अनुशंसित अगला कदम",
        "language_name": "हिन्दी",
        "categories": {
            "MONITOR": {
                "title": "निगरानी रखें",
                "instruction": "नियमित अवलोकन जारी रखें।",
                "detail": "मानक निर्धारित परिचालन अवलोकन जारी रखें। तत्काल किसी हस्तक्षेप की आवश्यकता नहीं है।",
                "roles": {
                    "general": "नियमित अवलोकन जारी रखें।",
                    "field_worker": "नियमित अवलोकन जारी रखें और सामान्य पारियों के दौरान किसी भी असामान्य स्थिति को दर्ज करें।",
                    "supervisor": "उपकरण को सामान्य निगरानी स्तर पर बनाए रखें।",
                    "safety_officer": "नियमित निगरानी की पुष्टि की गई। किसी सक्रिय वृद्धि की आवश्यकता नहीं है।"
                }
            },
            "INSPECT": {
                "title": "जाँच करें",
                "instruction": "प्रभावित प्रणाली की समीक्षा करें और आवर्ती चेतावनी संकेतों की जाँच करें।",
                "detail": "प्रभावित उपप्रणाली की जाँच करें और संभावित दोषों की पहचान के लिए हालिया रिपोर्टों से मिलान करें।",
                "roles": {
                    "general": "प्रभावित प्रणाली की समीक्षा करें और आवर्ती चेतावनी संकेतों की जाँच करें।",
                    "field_worker": "अगले चक्र में प्रभावित प्रणाली की जाँच करें और अवलोकनों को दर्ज करें।",
                    "supervisor": "सबूतों की समीक्षा करें और लक्षित उपप्रणाली निरीक्षण सौंपें।",
                    "safety_officer": "अभिसरित संकेतों को ट्रैक करें और हालिया रखरखाव लॉग का सत्यापन करें।"
                }
            },
            "INSPECT_ESCALATE": {
                "title": "जाँच + सूचना दें",
                "instruction": "सामान्य संचालन जारी रखने से पहले प्रभावित प्रणाली की जाँच करें और जिम्मेदार सुरक्षा टीम को सूचित करें।",
                "detail": "कई स्रोतों से प्राप्त संकेत बढ़ते जोखिम का संकेत देते हैं। आगे संचालन से पहले मानव सत्यापन अनिवार्य है।",
                "roles": {
                    "general": "सामान्य संचालन जारी रखने से पहले प्रभावित प्रणाली की जाँच करें और जिम्मेदार सुरक्षा टीम को सूचित करें।",
                    "field_worker": "प्रभावित प्रणाली का गहन निरीक्षण करें और तुरंत अपने पर्यवेक्षक को सूचित करें।",
                    "supervisor": "अगले परिचालन चक्र से पहले आपातकालीन प्रमाणित निरीक्षण का निर्देश दें।",
                    "safety_officer": "संकेतों की समीक्षा करें और स्थापित सुरक्षा प्रक्रिया के अनुसार कार्रवाई बढ़ाएं।"
                }
            },
            "ISOLATE_ESCALATE": {
                "title": "अलग करें + तत्काल सूचना दें",
                "instruction": "जब तक जिम्मेदार सुरक्षा टीम जाँच और सत्यापन न कर ले, तब तक प्रभावित उपकरण को सामान्य संचालन में वापस न लाएं।",
                "detail": "तत्काल मानव सुरक्षा हस्तक्षेप आवश्यक है। सुरक्षा दल द्वारा प्रमाणित किए जाने तक उपकरण को संचालन से अलग रखें।",
                "roles": {
                    "general": "जब तक जिम्मेदार सुरक्षा टीम जाँच और सत्यापन न कर ले, तब तक प्रभावित उपकरण को सामान्य संचालन में वापस न लाएं।",
                    "field_worker": "उपकरण को तुरंत रोकें, ड्यूटी में न लगाएं और तत्काल सुरक्षा नियंत्रण को सूचित करें।",
                    "supervisor": "उपकरण को संचालन से बाहर रखें और आपातकालीन तकनीकी निरीक्षण का समन्वय करें।",
                    "safety_officer": "सुरक्षा अलगाव का निर्देश जारी करें और पुनर्प्रमाणीकरण सुनिश्चित करें।"
                }
            }
        }
    }
}


def get_action_category_for_risk_level(risk_level: str) -> str:
    """Deterministically map a canonical RiskLevel to an ActionCategory."""
    norm = (risk_level or "").upper()
    if norm == "CRITICAL":
        return "ISOLATE_ESCALATE"
    elif norm == "HIGH":
        return "INSPECT_ESCALATE"
    elif norm == "MEDIUM":
        return "INSPECT"
    else:
        return "MONITOR"


def get_recommended_action(
    risk_level: str,
    language: str = "en",
    role: str = "general"
) -> Dict[str, Any]:
    """
    Deterministically resolve complete action guidance based on risk level, language, and role.
    Fallback is guaranteed to be clean English without throwing errors.
    """
    valid_lang = language if language in ACTION_TRANSLATIONS else "en"
    valid_role = role if role in ["general", "field_worker", "supervisor", "safety_officer"] else "general"

    category = get_action_category_for_risk_level(risk_level)
    dict_data = ACTION_TRANSLATIONS[valid_lang]
    cat_data = dict_data["categories"][category]

    role_instruction = cat_data["roles"].get(valid_role, cat_data["roles"]["general"])

    return {
        "category": category,
        "title": cat_data["title"],
        "header_tag": dict_data["header_tag"],
        "instruction": cat_data["instruction"],
        "detail": cat_data["detail"],
        "role_instruction": role_instruction,
        "language": valid_lang,
        "role": valid_role
    }
