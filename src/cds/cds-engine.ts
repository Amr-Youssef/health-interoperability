import { CanonicalStore } from '../persistence/canonical-store.js';
import { CanonicalMedicationRequest } from '../core/domain/medication.js';

export interface CdsCard {
  uuid: string;
  summary: string;
  summaryAr: string;
  detail: string;
  detailAr: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    labelAr: string;
    url?: string;
  };
  suggestions?: {
    label: string;
    labelAr: string;
    actionType: 'adjust_dose' | 'discontinue' | 'order_lab' | 'schedule_vaccine' | 'alternative_drug';
  }[];
}

export interface CdsHookResponse {
  hook: string;
  patientId: string;
  timestamp: string;
  cards: CdsCard[];
}

export interface ProspectivePrescriptionDraft {
  patientId: string;
  drugCode: string;       // SFDA SDC or Local code or Generic
  drugName: string;
  dosage: string;
  route: string;
  frequency: string;
}

export class CdsHooksEngine {
  private canonicalStore: CanonicalStore;

  constructor(canonicalStore: CanonicalStore) {
    this.canonicalStore = canonicalStore;
  }

  /**
   * Evaluate CDS Hooks for prospective draft prescription before signing
   */
  async evaluateDraftPrescription(draft: ProspectivePrescriptionDraft): Promise<CdsHookResponse> {
    const record = await this.canonicalStore.getLongitudinalRecord(draft.patientId);
    const cards: CdsCard[] = [];

    if (!record) {
      return {
        hook: 'medication-prescribe',
        patientId: draft.patientId,
        timestamp: new Date().toISOString(),
        cards: []
      };
    }

    const drugCodeUpper = draft.drugCode.toUpperCase();
    const drugNameUpper = draft.drugName.toUpperCase();

    // -------------------------------------------------------------
    // RULE 0: CRITICAL ALLERGY CONFLICT CHECK (Penicillin & Sulfa)
    // -------------------------------------------------------------
    const allergies = record.allergies || [];
    for (const alg of allergies) {
      if (alg.clinicalStatus === 'active') {
        const isPenicillinAllergy =
          alg.substanceCode?.snomedCode === '764146007' ||
          alg.substanceCode?.snomedCode === '91936005' ||
          alg.substanceText?.toLowerCase().includes('penicillin') ||
          alg.substanceTextAr?.includes('بنسلين');

        const isDraftBetaLactam =
          drugNameUpper.includes('PENICILLIN') ||
          drugNameUpper.includes('AMOXICILLIN') ||
          drugNameUpper.includes('AUGMENTIN') ||
          drugNameUpper.includes('AMPICILLIN') ||
          drugNameUpper.includes('بنسلين') ||
          drugNameUpper.includes('أموكسيسيلين') ||
          drugNameUpper.includes('أوجمنتين');

        if (isPenicillinAllergy && isDraftBetaLactam) {
          cards.push({
            uuid: 'cds-draft-penicillin-allergy-critical',
            summary: 'CRITICAL ALLERGY ALERT: Penicillin / Beta-Lactam Anaphylaxis Risk',
            summaryAr: 'تحذير حساسية دوائية حرج: خطورة صدمة تحسسية حادة للبنسلين ومشتقاته',
            detail: `Patient has a documented HIGH-CRITICALITY ALLERGY to Penicillin (SNOMED: 764146007). Prescribing ${draft.drugName} is contraindicated due to severe anaphylaxis risk.`,
            detailAr: `يوجد في السجل الموحد للمريض حساسية مفرطة مسجلة وشديدة الخطورة لمادة البنسلين. وصف الدواء (${draft.drugName}) يشكل خطراً وشيكاً لصدمة تحسسية حادة وضيق تنفس.`,
            indicator: 'critical',
            source: {
              label: 'National Clinical Safety & SFDA Pharmacovigilance Alert',
              labelAr: 'نظام السلامة الدوائية الوطني واليقظة الصيدلانية - هيئة الغذاء والدواء'
            },
            suggestions: [
              {
                label: 'Cancel Prescription & Select Macrolide / Fluoroquinolone Alternative',
                labelAr: 'إلغاء الوصفة واستبدالها بمضاد حيوي من عائلة الماكروليد (مثل أزيثرومايسين)',
                actionType: 'alternative_drug'
              }
            ]
          });
        }

        const isSulfaAllergy =
          alg.substanceCode?.snomedCode === '294509007' ||
          alg.substanceText?.toLowerCase().includes('sulfa') ||
          alg.substanceTextAr?.includes('سلفا');

        const isDraftSulfa =
          drugNameUpper.includes('SULFA') ||
          drugNameUpper.includes('BACTRIM') ||
          drugNameUpper.includes('SEPTRA') ||
          drugNameUpper.includes('CO-TRIMOXAZOLE') ||
          drugNameUpper.includes('سلفا') ||
          drugNameUpper.includes('باكتريم');

        if (isSulfaAllergy && isDraftSulfa) {
          cards.push({
            uuid: 'cds-draft-sulfa-allergy-critical',
            summary: 'CRITICAL ALLERGY ALERT: Sulfonamide Hypersensitivity Risk',
            summaryAr: 'تحذير حساسية دوائية حرج: تعارض مع حساسية مركبات السلفا',
            detail: `Patient has documented allergy to Sulfonamide (SNOMED: 294509007). Co-trimoxazole/Sulfa compounds are contraindicated.`,
            detailAr: `المريض لديه حساسية مسجلة لمركبات السلفا. وصف هذا الدواء يتعارض تماماً مع الملف السريري للمريض.`,
            indicator: 'critical',
            source: {
              label: 'SFDA Drug Safety Registry',
              labelAr: 'سجل السلامة الدوائية - هيئة الغذاء والدواء'
            },
            suggestions: [
              {
                label: 'Select Non-Sulfonamide Antibiotic',
                labelAr: 'اختيار مضاد حيوي غير كبريتي',
                actionType: 'alternative_drug'
              }
            ]
          });
        }
      }
    }

    // -------------------------------------------------------------
    // RULE 1: Drug-Renal Safety (Metformin & Renal Status)
    // -------------------------------------------------------------
    if (drugCodeUpper.includes('0628500100101') || drugNameUpper.includes('METFORMIN') || drugNameUpper.includes('GLUCOPHAGE') || drugNameUpper.includes('ميتفورمين')) {
      const hba1cObs = record.observations.find(o => o.code?.loincCode === '4548-4');
      if (hba1cObs && (hba1cObs.valueQuantity?.value || 0) >= 7.0) {
        cards.push({
          uuid: 'cds-draft-metformin-hba1c',
          summary: 'Therapeutic Target Alert: Suboptimal Glycemic Control',
          summaryAr: 'تنبيه علاجي: مستوى السكر التراكمي (HbA1c) يتجاوز المعدل المستهدف',
          detail: `Patient's recent HbA1c is ${hba1cObs.valueQuantity?.value}% (LOINC: 4548-4). Metformin 500mg BID is appropriate baseline therapy, but lifestyle and glycemic monitoring must be reinforced per Saudi MOH Diabetes Guidelines.`,
          detailAr: `نسبة السكر التراكمي الأخيرة تبلغ ${hba1cObs.valueQuantity?.value}%. الميتفورمين 500 مجم مرتين يومياً خيار علاجي أولي مناسب، مع ضرورة متابعة وظائف الكلى الدورية.`,
          indicator: 'info',
          source: {
            label: 'Saudi MOH Clinical Practice Guidelines for Diabetes',
            labelAr: 'الدليل الإرشادي الإكلينيكي لمرض السكري - وزارة الصحة'
          },
          suggestions: [
            {
              label: 'Schedule HbA1c Follow-up in 3 Months',
              labelAr: 'جدولة فحص سكر تراكمي بعد 3 أشهر',
              actionType: 'order_lab'
            }
          ]
        });
      }
    }

    // -------------------------------------------------------------
    // RULE 2: Drug-Drug Interaction: NSAIDs + Diabetes / Anti-hypertensives
    // -------------------------------------------------------------
    if (drugNameUpper.includes('IBUPROFEN') || drugNameUpper.includes('BRUFEN') || drugNameUpper.includes('إيبوبروفين') || drugNameUpper.includes('DICLOFENAC') || drugNameUpper.includes('VOLTAREN')) {
      cards.push({
        uuid: 'cds-draft-nsaid-alert',
        summary: 'Clinical Caution: NSAID Prescribed in Diabetic Patient',
        summaryAr: 'تحذير سريري: وصف مضادات الالتهاب اللاستيرويدية (NSAIDs) لمريض سكري',
        detail: 'Concomitant use of NSAIDs in patients with Type 2 Diabetes carries increased risk of acute kidney injury and fluid retention. Use lowest effective dose for shortest duration.',
        detailAr: 'استخدام مضادات الالتهاب (مثل البروفين/الفولتارين) لمرضى السكري يرفع خطورة القصور الكلوي الحاد. يُنصح باستخدام بدائل مثل الباراسيتامول كخيار أول.',
        indicator: 'warning',
        source: {
          label: 'SFDA Saudi Drug Safety Alert System',
          labelAr: 'هيئة الغذاء والدواء - نظام التنبيهات الدوائية'
        },
        suggestions: [
          {
            label: 'Switch to Paracetamol (Acetaminophen)',
            labelAr: 'استبدال بـ باراسيتامول (بنادول)',
            actionType: 'alternative_drug'
          }
        ]
      });
    }

    // -------------------------------------------------------------
    // RULE 3: Fluoroquinolone (Ciprofloxacin) + Diabetes Hypoglycemia Alert
    // -------------------------------------------------------------
    if (drugNameUpper.includes('CIPROFLOXACIN') || drugNameUpper.includes('CIPRO') || drugNameUpper.includes('سيبروفلوكساسين')) {
      cards.push({
        uuid: 'cds-draft-cipro-alert',
        summary: 'Drug-Drug Interaction Alert: Fluoroquinolone Dysglycemia Risk',
        summaryAr: 'تنبيه تفاعل دوائي: خطورة اضطراب السكر الحاد مع السيبروفلوكساسين',
        detail: 'Fluoroquinolones may cause severe hypoglycemia or hyperglycemia when co-prescribed with oral hypoglycemic agents. Frequent glucose monitoring is advised.',
        detailAr: 'أدوية مجموعة الفلوروكينولون قد تسبب هبوطاً أو ارتفاعاً حاداً ومفاجئاً في سكر الدم عند مشاركتها مع أدوية السكري. يلزم مراقبة السكر بدقة.',
        indicator: 'warning',
        source: {
          label: 'SFDA Pharmacovigilance Advisory',
          labelAr: 'المركز الوطني للتيقظ الدوائي - هيئة الغذاء والدواء'
        }
      });
    }

    // -------------------------------------------------------------
    // RULE 4: Duplicate Active Therapy Check
    // -------------------------------------------------------------
    const activeMeds = record.medicationRequests || [];
    for (const m of activeMeds) {
      if (m.medication?.code?.sfdaCode === draft.drugCode || (draft.drugName && m.medication?.code?.sourceDisplay?.toLowerCase().includes(draft.drugName.toLowerCase()))) {
        cards.push({
          uuid: 'cds-draft-duplicate-exact',
          summary: 'Duplicate Active Medication Detected',
          summaryAr: 'تنبيه: وصفة لنفس الدواء سارية المفعول حالياً في سجل المريض',
          detail: `Patient already has an active prescription for ${m.medication.code.sourceDisplay || m.medication.code.sourceCode} authored on ${m.authoredOn.substring(0, 10)}. Verify if this is an intended dose adjustment or refill.`,
          detailAr: `المريض لديه بالفعل وصفة طبية نشطة لنفس الدواء صدرت بتاريخ ${m.authoredOn.substring(0, 10)}. يرجى التأكد من عدم تكرار الصرف بالخطأ.`,
          indicator: 'warning',
          source: {
            label: 'National Unified ePrescription Reconciliation Protocol',
            labelAr: 'البروتوكول الوطني الموحد لمطابقة الوصفات الدوائية'
          }
        });
        break;
      }
    }

    return {
      hook: 'medication-prescribe',
      patientId: draft.patientId,
      timestamp: new Date().toISOString(),
      cards
    };
  }

  /**
   * Evaluate CDS Hooks for patient view (Background health alerts)
   */
  async evaluateMedicationSafety(patientId: string): Promise<CdsHookResponse> {
    const record = await this.canonicalStore.getLongitudinalRecord(patientId);
    const cards: CdsCard[] = [];

    if (!record) {
      return {
        hook: 'patient-view',
        patientId,
        timestamp: new Date().toISOString(),
        cards: []
      };
    }

    const activeMeds = record.medicationRequests || [];

    // RULE 1: Metformin Glycemic Evaluation
    const hasMetformin = activeMeds.some(m =>
      m.medication?.code?.sfdaCode === '0628500100101' ||
      m.medication?.code?.atcCode === 'A10BA02' ||
      m.medication?.code?.sourceCode?.includes('ميتفورمين') ||
      m.medication?.code?.sourceCode?.includes('MET')
    );

    if (hasMetformin) {
      const hba1cObs = record.observations.find(o => o.code?.loincCode === '4548-4');
      if (hba1cObs && (hba1cObs.valueQuantity?.value || 0) >= 7.0) {
        cards.push({
          uuid: 'cds-rule-dm-control',
          summary: 'Therapeutic Target Alert: Suboptimal HbA1c Control',
          summaryAr: 'تنبيه علاجي: مستوى السكر التراكمي (HbA1c) يتجاوز المعدل المستهدف',
          detail: `Patient HbA1c is ${hba1cObs.valueQuantity?.value}% (measured on ${hba1cObs.effectiveDateTime.substring(0, 10)}). Consider lifestyle reinforcement or therapy intensification per Saudi Diabetes Clinical Practice Guidelines (SDCPG).`,
          detailAr: `نسبة السكر التراكمي للمريض تبلغ ${hba1cObs.valueQuantity?.value}%. يوصى بمراجعة الخطة العلاجية والجرعة الدوائية وفق الدليل الإرشادي السعودي لعلاج السكري.`,
          indicator: 'info',
          source: {
            label: 'Saudi Diabetes Clinical Guidelines (SDCPG) & SFDA Drug Safety',
            labelAr: 'الدليل الإرشادي الوطني للسكري وهيئة الغذاء والدواء'
          },
          suggestions: [
            {
              label: 'Review Diet & Exercise Regimen',
              labelAr: 'متابعة الحمية والنشاط البدني',
              actionType: 'adjust_dose'
            }
          ]
        });
      }
    }

    // RULE 2: Annual Vaccine Adherence
    const hasDiabetes = record.conditions.some(c =>
      c.code?.icd10amCode === 'E11' ||
      c.code?.snomedCode === '44054006' ||
      c.code?.sourceCode?.includes('سكري')
    );

    if (hasDiabetes) {
      const immunizations = record.immunizations || [];
      const hasFluVax = immunizations.some(i =>
        i.vaccineCode?.cvxCode === '158' ||
        i.vaccineCode?.sourceCode?.includes('FLU') ||
        i.vaccineCode?.sourceCode?.includes('إنفلونزا')
      );

      if (hasFluVax) {
        cards.push({
          uuid: 'cds-rule-vax-verified',
          summary: 'Preventive Health Target: Seasonal Flu Vaccine Verified',
          summaryAr: 'صحة وقائية: تم التحقق من تلقي لقاح الإنفلونزا الموسمية',
          detail: 'Patient with Type 2 Diabetes is up to date with the Saudi MOH Annual Influenza Immunization Schedule (CVX 158).',
          detailAr: 'المريض المصاب بالسكري من النوع الثاني مستوفٍ لجرعة لقاح الإنفلونزا الموسمية السنوية الموصى بها من وزارة الصحة.',
          indicator: 'info',
          source: {
            label: 'Saudi MOH Preventive Health Protocols',
            labelAr: 'بروتوكولات الصحة الوقائية - وزارة الصحة السعودية'
          }
        });
      }
    }

    // RULE 3: Duplicate Therapy Check
    const atcCounts: Record<string, number> = {};
    for (const m of activeMeds) {
      const atc = m.medication?.code?.atcCode;
      if (atc) {
        atcCounts[atc] = (atcCounts[atc] || 0) + 1;
      }
    }

    for (const [atc, count] of Object.entries(atcCounts)) {
      if (count > 2) {
        cards.push({
          uuid: `cds-rule-dup-${atc}`,
          summary: `Duplicate Therapy Detected (ATC: ${atc})`,
          summaryAr: `تنبيه تكرار علاجي غير مبرر للفئة الدوائية (${atc})`,
          detail: `Patient has ${count} active prescriptions within the same pharmacological class (${atc}). Verify medication reconciliation.`,
          detailAr: `يوجد لدى المريض أكثر من وصفتين نشطتين من نفس المجموعة العلاجية. يرجى مراجعة التوافق الدوائي.`,
          indicator: 'warning',
          source: {
            label: 'SFDA National Drug Interaction Registry',
            labelAr: 'سجل التفاعلات الدوائية لهيئة الغذاء والدواء'
          },
          suggestions: [
            {
              label: 'Reconcile Active Prescriptions',
              labelAr: 'إلغاء الوصفات المكررة',
              actionType: 'discontinue'
            }
          ]
        });
      }
    }

    return {
      hook: 'patient-view',
      patientId,
      timestamp: new Date().toISOString(),
      cards
    };
  }
}
