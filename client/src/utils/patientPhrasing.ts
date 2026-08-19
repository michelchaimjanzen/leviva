// =========================================================================
// GENDER-AWARE HEBREW PHRASING
// Hebrew verbs/nouns inflect by gender, which is why the source material
// shipped as two near-duplicate .docx files (ילד vs ילדה). This module is
// the single place that resolves gendered phrasing, so PatientIntakeForm
// never hardcodes wording for one gender.
// =========================================================================

import type { Gender } from '../types/patient';

interface GenderedPair {
  male: string;
  female: string;
}

function pick(gender: Gender, pair: GenderedPair): string {
  return gender === 'male' ? pair.male : pair.female;
}

/** "child" noun: הילד / הילדה */
export function childNoun(gender: Gender): string {
  return pick(gender, { male: 'הילד', female: 'הילדה' });
}

/** "your son/daughter": בנכם / בתכם */
export function yourChildNoun(gender: Gender): string {
  return pick(gender, { male: 'בנכם', female: 'בתכם' });
}

/** possessive "his/her" attached forms are handled per-phrase below since
 *  Hebrew suffixes attach to the noun, not as a standalone word. */

export const phrasing = {
  formTitle: (gender: Gender) =>
    pick(gender, {
      male: 'שאלון לקראת אבחון (למילוי ההורים)',
      female: 'שאלון לקראת הערכת שפה במעבדת שפה ומח (למילוי ההורים)',
    }),

  intro: (gender: Gender) =>
    `הורים יקרים, השאלון שלפניכם מהווה כלי חשוב לקראת האבחון של ${yourChildNoun(
      gender
    )}. נשמח אם תקדישו לו זמן ותמלאו אותו בתשומת לב ובפירוט.`,

  childSectionTitle: (gender: Gender) => `פרטי ${childNoun(gender)}`,

  wearsGlasses: (gender: Gender) =>
    pick(gender, { male: 'האם מרכיב משקפיים?', female: 'האם מרכיבה משקפיים?' }),

  childPrimaryLanguage: (gender: Gender) =>
    pick(gender, {
      male: 'מה השפה/שפות העיקריות שבה/ן הילד מתקשר?',
      female: 'מה השפה/שפות העיקריות שבה/ן הילדה מתקשרת?',
    }),

  referralReason: (gender: Gender) =>
    pick(gender, {
      male: 'הסיבה להפניה לאבחון (תאר/י את קשייו של הילד), ביוזמת מי הופנה לאבחון?',
      female: 'הסיבה להפניה לאבחון (תאר/י את קשייה של הילדה), ביוזמת מי הופנתה לאבחון?',
    }),

  hasReceivedTreatment: (gender: Gender) =>
    pick(gender, { male: 'האם בנכם היה בטיפול?', female: 'האם בתכם היתה בטיפול?' }),

  treatmentsGivenTo: (gender: Gender) =>
    pick(gender, {
      male: 'פרט/י בטבלה אילו טיפולים ניתנו לבנכם?',
      female: 'פרט/י בטבלה אילו טיפולים ניתנו לבתכם?',
    }),

  takesMedication: (gender: Gender) =>
    pick(gender, {
      male: 'האם הילד נוטל או נטל תרופות כלשהן באופן קבוע?',
      female: 'האם הילדה נוטלת או נטלה תרופות כלשהן באופן קבוע?',
    }),

  readingAcquisition: (gender: Gender) =>
    pick(gender, {
      male: "תאר/י בקצרה את תהליך רכישת הקריאה של ילדך בכיתה א':",
      female: "תאר/י בקצרה את תהליך רכישת הקריאה של ילדתך בכיתה א':",
    }),

  readingComprehension: (gender: Gender) =>
    pick(gender, {
      male: 'האם ישנם קשיים בהבנת הנקרא? האם הילד מבין את אשר הוא קורא?',
      female: 'האם ישנם קשיים בהבנת הנקרא? האם הילדה מבינה את אשר היא קוראת?',
    }),

  writingDescription: (gender: Gender) =>
    pick(gender, {
      male: 'תאר/י את כתיבתו של ילדך (האם כותב בשגיאות? האם כתב היד קריא וברור?):',
      female: 'תאר/י את כתיבתה של ילדתך (האם כותבת בשגיאות? האם כתב היד קריא וברור?):',
    }),

  expressSelfInWriting: (gender: Gender) =>
    pick(gender, {
      male: 'האם הילד מצליח להביע את עצמו בכתב בצורה ברורה ומאורגנת?',
      female: 'האם הילדה מצליחה להביע את עצמה בכתב בצורה ברורה ומאורגנת?',
    }),

  receivesSchoolSupport: (gender: Gender) =>
    pick(gender, {
      male: 'האם ילדך קיבל/מקבל סיוע כלשהו במסגרת בית הספר?',
      female: 'האם ילדתך קיבלה/מקבלת סיוע כלשהו במסגרת בית הספר?',
    }),

  hasWideVocabulary: (gender: Gender) =>
    pick(gender, {
      male: 'האם לילד יש אוצר מילים רחב?',
      female: 'האם לילדה יש אוצר מילים רחב?',
    }),

  expressesSelfFluently: (gender: Gender) =>
    pick(gender, {
      male: 'האם הילד מצליח להתבטא ביומיום באופן ברור ושוטף?',
      female: 'האם הילדה מצליחה להתבטא ביומיום באופן ברור ושוטף?',
    }),

  speaksInCorrectSentences: (gender: Gender) =>
    pick(gender, {
      male: 'האם הילד מדבר במשפטים תקינים וברורים?',
      female: 'האם הילדה מדברת במשפטים תקינים וברורים?',
    }),
};

export const developmentalDomainLabels: Record<string, string> = {
  hearing: 'שמיעה (דלקות, נוזלים וכו..)',
  vision: 'ראייה (משקפיים, מיקוד ראיה, פזילה וכו...)',
  fineMotor: 'מוטוריקה עדינה (החזקת כלי כתיבה, ציור, כתיבה וכו..)',
  speechLanguage: 'שפה- דיבור (מילה ראשונה, משפט ראשון וכו..)',
  generalHealth: 'בריאות כללית (מחלות, תאונות, חבלות ראש)',
};

export const treatmentTypeLabels: Record<string, string> = {
  speechLanguageTherapy: 'קלינאית תקשורת',
  occupationalTherapy: 'ריפוי בעיסוק',
  psychological: 'טיפול פסיכולוגי',
  remedialTeaching: 'הוראה מתקנת',
  other: 'אחר',
};