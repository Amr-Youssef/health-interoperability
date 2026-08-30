export interface HospitalAPatientRow {
    رقم_المريض: string;
    الاسم_الاول: string;
    اسم_العائلة: string;
    الجنس: string;
    تاريخ_الميلاد: string;
    رقم_الهوية: string;
    نوع_الهوية: string;
    الجنسية: string;
    رقم_الجوال: string;
    المدينة?: string;
    الحالة_الاجتماعية?: string;
}
export interface HospitalAVisitRow {
    رقم_الزيارة: string;
    رقم_المريض: string;
    تاريخ_الدخول: string;
    تاريخ_الخروج: string;
    نوع_الزيارة: string;
    القسم: string;
    الطبيب: string;
    سبب_الزيارة: string;
}
export interface HospitalADiagnosisRow {
    رقم_التشخيص: string;
    رقم_الزيارة: string;
    كود_التشخيص: string;
    وصف_التشخيص: string;
    نوع_التشخيص: string;
    تاريخ_التسجيل: string;
}
export interface HospitalALabResultRow {
    رقم_الفحص: string;
    رقم_الزيارة: string;
    اسم_الفحص: string;
    النتيجة: string;
    الوحدة: string;
    المرجع_الطبيعي: string;
    حالة_النتيجة: string;
    تاريخ_الفحص: string;
}
export interface HospitalAInsuranceRow {
    رقم_البوليصة: string;
    رقم_المريض: string;
    شركة_التأمين: string;
    كود_الشركة: string;
    رقم_العضوية: string;
    فئة_الشبكة: string;
    نسبة_التحمل: string;
    الحد_الأقصى_للتحمل: string;
    تاريخ_البدء: string;
    تاريخ_الانتهاء: string;
}
export interface HospitalABillRow {
    رقم_الفاتورة: string;
    رقم_الزيارة: string;
    رقم_المريض: string;
    كود_الخدمة: string;
    اسم_الخدمة: string;
    السعر_الإجمالي: string;
    تحمل_المريض: string;
    مطالبة_التأمين: string;
    تاريخ_الفاتورة: string;
}
export interface HospitalARxRow {
    رقم_الوصفة: string;
    رقم_الزيارة: string;
    رقم_المريض: string;
    كود_الدواء: string;
    اسم_الدواء: string;
    طريقة_الاستخدام: string;
    الكمية: string;
    التكرار_المسموح: string;
    تاريخ_الوصفة: string;
}
export interface HospitalAVaxRow {
    رقم_التطعيم: string;
    رقم_المريض: string;
    كود_اللقاح: string;
    اسم_اللقاح: string;
    رقم_التشغيلة: string;
    تاريخ_الانتهاء: string;
    تاريخ_الإعطاء: string;
    مكان_الحقن: string;
}
export interface HospitalAAllergyRow {
    رقم_الحساسية: string;
    رقم_المريض: string;
    نوع_الحساسية: string;
    المادة_المسببة: string;
    كود_المادة: string;
    درجة_الخطورة: string;
    التفاعل_التحسسي: string;
    تاريخ_التسجيل: string;
}
export declare const HOSPITAL_A_DATASET: {
    patients: HospitalAPatientRow[];
    visits: HospitalAVisitRow[];
    diagnoses: HospitalADiagnosisRow[];
    labResults: HospitalALabResultRow[];
    insurance: HospitalAInsuranceRow[];
    bills: HospitalABillRow[];
    prescriptions: HospitalARxRow[];
    vaccinations: HospitalAVaxRow[];
    allergies: HospitalAAllergyRow[];
};
