export interface HospitalBPtMasterRow {
    pt_id: number;
    mrn: string;
    national_id?: string;
    iqama_no?: string;
    first_name_ar: string;
    last_name_ar: string;
    first_name_en: string;
    last_name_en: string;
    sex: string;
    birth_date: string;
    phone: string;
    nationality_code: string;
}
export interface HospitalBEncounterRow {
    enc_id: string;
    mrn: string;
    enc_type: string;
    admit_dt: string;
    discharge_dt: string;
    attending_dr: string;
    dept_code: string;
    status: string;
}
export interface HospitalBDxRow {
    dx_id: string;
    enc_id: string;
    icd_code: string;
    dx_desc: string;
    dx_rank: number;
    recorded_dt: string;
}
export interface HospitalBLabOrderRow {
    order_id: string;
    enc_id: string;
    test_code: string;
    test_name: string;
    result: number;
    unit: string;
    ref_low: number;
    ref_high: number;
    result_dt: string;
    status: string;
}
export interface HospitalBInsPolicyRow {
    policy_id: string;
    mrn: string;
    payer_code: string;
    payer_name: string;
    member_id: string;
    plan_tier: string;
    copay_rate: number;
    max_copay_sar: number;
    valid_from: string;
    valid_to: string;
}
export interface HospitalBClaimRow {
    claim_id: string;
    enc_id: string;
    mrn: string;
    service_code: string;
    service_desc: string;
    qty: number;
    unit_price: number;
    total_gross: number;
    patient_share: number;
    payer_share: number;
    claim_date: string;
}
export interface HospitalBRxRow {
    rx_id: string;
    enc_id: string;
    mrn: string;
    drug_code: string;
    drug_name: string;
    sig: string;
    qty: number;
    refills: number;
    prescribed_dt: string;
}
export interface HospitalBVaccineRow {
    vax_id: string;
    mrn: string;
    vax_code: string;
    vax_name: string;
    lot_no: string;
    exp_dt: string;
    admin_dt: string;
    admin_site: string;
}
export interface HospitalBAllergyRow {
    allergy_id: string;
    mrn: string;
    allergy_type: string;
    allergen: string;
    snomed_code: string;
    criticality: string;
    reaction_desc: string;
    recorded_dt: string;
}
export declare const HOSPITAL_B_DATASET: {
    patients: HospitalBPtMasterRow[];
    encounters: HospitalBEncounterRow[];
    diagnoses: HospitalBDxRow[];
    labOrders: HospitalBLabOrderRow[];
    policies: HospitalBInsPolicyRow[];
    claims: HospitalBClaimRow[];
    prescriptions: HospitalBRxRow[];
    vaccinations: HospitalBVaccineRow[];
    allergies: HospitalBAllergyRow[];
};
