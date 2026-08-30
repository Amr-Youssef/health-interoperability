export type TransformFn = (value: any, params?: Record<string, any>) => any;

export class TransformEngine {
  private transforms: Map<string, TransformFn> = new Map();

  constructor() {
    this.registerDefaultTransforms();
  }

  private registerDefaultTransforms() {
    // 1. Gender Normalization
    this.transforms.set('gender_normalize', (val: any) => {
      if (!val) return 'unknown';
      const s = String(val).trim().toLowerCase();
      if (s === 'ذ' || s === 'ذكر' || s === 'm' || s === 'male' || s === '1') return 'male';
      if (s === 'أ' || s === 'أنثى' || s === 'f' || s === 'female' || s === '2') return 'female';
      if (s === 'other' || s === 'آخر') return 'other';
      return 'unknown';
    });

    // 2. Date Normalization (DD/MM/YYYY -> YYYY-MM-DD)
    this.transforms.set('date_normalize', (val: any) => {
      if (!val) return undefined;
      const s = String(val).trim();
      
      // Check for DD/MM/YYYY
      const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
      const match = s.match(ddmmyyyy);
      if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      }

      // Check if already ISO YYYY-MM-DD
      const isoymd = /^(\d{4})-(\d{2})-(\d{2})/;
      if (isoymd.test(s)) {
        return s.substring(0, 10);
      }

      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().substring(0, 10);
      }

      return s;
    });

    // 3. DateTime Normalization to ISO 8601
    this.transforms.set('datetime_normalize', (val: any) => {
      if (!val) return undefined;
      const s = String(val).trim();

      // Check for DD/MM/YYYY HH:mm or DD/MM/YYYY HH:mm:ss
      const ddmmyyyyTime = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
      const match = s.match(ddmmyyyyTime);
      if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        const hour = match[4].padStart(2, '0');
        const min = match[5].padStart(2, '0');
        const sec = (match[6] || '00').padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
      }

      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }

      return s;
    });

    // 4. Encounter Type / Class Mapping
    this.transforms.set('encounter_type_map', (val: any) => {
      if (!val) return 'outpatient';
      const s = String(val).trim().toUpperCase();
      if (s === 'ع' || s === 'OPD' || s === 'AMB' || s === 'AMBULATORY' || s === 'عيادة') return 'outpatient';
      if (s === 'ط' || s === 'EMR' || s === 'EMERGENCY' || s === 'طوارئ') return 'emergency';
      if (s === 'د' || s === 'INP' || s === 'INPATIENT' || s === 'تنويم') return 'inpatient';
      if (s === 'افتراضي' || s === 'VR' || s === 'VIRTUAL') return 'virtual';
      return 'outpatient';
    });

    // 5. Diagnosis Rank Mapping
    this.transforms.set('diagnosis_rank_map', (val: any) => {
      if (!val) return 'secondary';
      const s = String(val).trim().toLowerCase();
      if (s === 'ر' || s === 'رئيسي' || s === '1' || s === 'primary' || s === 'main') return 'primary';
      return 'secondary';
    });

    // 6. Number / Decimal parser
    this.transforms.set('number_parse', (val: any) => {
      if (val === null || val === undefined) return undefined;
      const num = parseFloat(String(val).replace(/,/g, ''));
      return isNaN(num) ? undefined : num;
    });

    // 7. Arabic String Normalizer
    this.transforms.set('arabic_clean', (val: any) => {
      if (!val) return '';
      return String(val)
        .trim()
        .replace(/[\u064B-\u065F]/g, '') // strip tashkeel
        .replace(/[إأآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
    });
  }

  transform(ruleName: string, value: any, params?: Record<string, any>): any {
    const fn = this.transforms.get(ruleName);
    if (!fn) {
      console.warn(`Transform rule '${ruleName}' not found. Returning original value.`);
      return value;
    }
    return fn(value, params);
  }

  registerTransform(name: string, fn: TransformFn): void {
    this.transforms.set(name, fn);
  }
}
