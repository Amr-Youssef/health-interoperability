export const HOSPITAL_B_DATASET = {
    patients: [
        {
            pt_id: 101,
            mrn: 'HB-789100',
            national_id: '1088445566',
            first_name_ar: 'احمد',
            last_name_ar: 'الراشدي',
            first_name_en: 'Ahmed',
            last_name_en: 'Al-Rashidi',
            sex: 'M',
            birth_date: '1984-04-01',
            phone: '+966501234567',
            nationality_code: 'SAU'
        },
        {
            pt_id: 102,
            mrn: 'HB-789105',
            iqama_no: '2099334455',
            first_name_ar: 'فاطمة',
            last_name_ar: 'الحربي',
            first_name_en: 'Fatima',
            last_name_en: 'Al-Harbi',
            sex: 'F',
            birth_date: '1992-11-15',
            phone: '+966559876543',
            nationality_code: 'YEM'
        }
    ],
    encounters: [
        {
            enc_id: 'ENC-501',
            mrn: 'HB-789100',
            enc_type: 'OPD',
            admit_dt: '2026-08-20T08:15:00Z',
            discharge_dt: '2026-08-20T10:00:00Z',
            attending_dr: 'SCFHS-DR-4412',
            dept_code: 'ENDOCRINE',
            status: 'completed'
        }
    ],
    diagnoses: [
        {
            dx_id: 'DX-B-201',
            enc_id: 'ENC-501',
            icd_code: 'E11.9',
            dx_desc: 'Type 2 diabetes mellitus, without complications',
            dx_rank: 1,
            recorded_dt: '2026-08-20T09:00:00Z'
        }
    ],
    labOrders: [
        {
            order_id: 'LAB-B-771',
            enc_id: 'ENC-501',
            test_code: 'HBA1C',
            test_name: 'Hemoglobin A1c',
            result: 7.2,
            unit: '%',
            ref_low: 4.0,
            ref_high: 5.6,
            result_dt: '2026-08-20T09:45:00Z',
            status: 'final'
        }
    ],
    policies: [
        {
            policy_id: 'POL-TAW-4001',
            mrn: 'HB-789100',
            payer_code: 'CHI-INS-102',
            payer_name: 'Tawuniya Cooperative Insurance',
            member_id: 'TAW-90021',
            plan_tier: 'VIP',
            copay_rate: 0.0,
            max_copay_sar: 0,
            valid_from: '2026-01-01',
            valid_to: '2026-12-31'
        }
    ],
    claims: [
        {
            claim_id: 'CLM-HB-991',
            enc_id: 'ENC-501',
            mrn: 'HB-789100',
            service_code: 'SBS-E11',
            service_desc: 'Endocrine Specialist Consultation',
            qty: 1,
            unit_price: 350.0,
            total_gross: 350.0,
            patient_share: 0.0,
            payer_share: 350.0,
            claim_date: '2026-08-20T10:15:00Z'
        },
        {
            claim_id: 'CLM-HB-992',
            enc_id: 'ENC-501',
            mrn: 'HB-789100',
            service_code: 'SBS-LAB-1020',
            service_desc: 'Hemoglobin A1c Glycated Blood Test',
            qty: 1,
            unit_price: 150.0,
            total_gross: 150.0,
            patient_share: 0.0,
            payer_share: 150.0,
            claim_date: '2026-08-20T10:15:00Z'
        }
    ],
    prescriptions: [
        {
            rx_id: 'RX-B-8801',
            enc_id: 'ENC-501',
            mrn: 'HB-789100',
            drug_code: 'RX-MET-500',
            drug_name: 'Metformin HCl 500mg Tablet',
            sig: '1 tab PO BID with meals',
            qty: 60,
            refills: 2,
            prescribed_dt: '2026-08-20T09:30:00Z'
        }
    ],
    vaccinations: [
        {
            vax_id: 'VAX-B-991',
            mrn: 'HB-789100',
            vax_code: 'VAC-FLU-QUAD',
            vax_name: 'Quadrivalent Influenza Vaccine IM',
            lot_no: 'LOT-FLU-B99',
            exp_dt: '2026-12-31',
            admin_dt: '2026-08-20T09:50:00Z',
            admin_site: 'Left Deltoid'
        }
    ],
    allergies: [
        {
            allergy_id: 'ALG-HB-201',
            mrn: 'HB-789100',
            allergy_type: 'medication',
            allergen: 'Sulfonamide',
            snomed_code: '294509007',
            criticality: 'high',
            reaction_desc: 'Severe skin rash and facial angioedema',
            recorded_dt: '2025-11-20T14:00:00Z'
        }
    ]
};
//# sourceMappingURL=hospital-b-data.js.map