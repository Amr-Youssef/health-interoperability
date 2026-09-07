import { RawRecord } from '../../core/domain/raw-record.js';
import { MappingConfiguration, FieldMappingRule } from '../../core/domain/mapping-config.js';
import { TransformEngine } from '../transformation/transform-engine.js';
import { TerminologyService } from '../../terminology/terminology-service.js';
import { DEFAULT_MAPPINGS } from '../config/mapping-registry.js';
import { ClinicalCode } from '../../core/domain/clinical-code.js';
import { FhirResourceMapper } from './fhir-resource-mapper.js';

export interface MappedEntityResult {
  rawRecordId: string;
  sourceSystemId: string;
  sourceRecordId: string;
  targetCanonicalEntity: string;
  mappingConfigId: string;
  mappingVersion: string;
  terminologyMapVersion?: string;
  data: Record<string, any>;
  unmappedFields: string[];
}

export class MappingEngine {
  private configurations: Map<string, MappingConfiguration> = new Map();
  private transformEngine: TransformEngine;
  private terminologyService: TerminologyService;
  private fhirMapper: FhirResourceMapper;

  constructor(terminologyService: TerminologyService, transformEngine?: TransformEngine) {
    this.terminologyService = terminologyService;
    this.transformEngine = transformEngine || new TransformEngine();
    this.fhirMapper = new FhirResourceMapper(this.terminologyService, this.transformEngine);
    this.loadDefaultConfigurations();
  }

  private loadDefaultConfigurations() {
    for (const config of DEFAULT_MAPPINGS) {
      const key = `${config.sourceSystemId}:${config.sourceEntityType.toLowerCase()}`;
      this.configurations.set(key, config);
    }
  }

  registerConfiguration(config: MappingConfiguration): void {
    const key = `${config.sourceSystemId}:${config.sourceEntityType.toLowerCase()}`;
    this.configurations.set(key, config);
  }

  getConfiguration(sourceSystemId: string, sourceEntityType: string): MappingConfiguration | null {
    const key = `${sourceSystemId}:${sourceEntityType.toLowerCase()}`;
    return this.configurations.get(key) || null;
  }

  getAllConfigurations(): MappingConfiguration[] {
    return Array.from(this.configurations.values());
  }

  private setNestedProperty(obj: Record<string, any>, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Executes the 3-stage Mapping Pipeline on a raw record
   */
  async mapRecord(rawRecord: RawRecord): Promise<MappedEntityResult> {
    const config = this.getConfiguration(rawRecord.sourceSystemId, rawRecord.sourceEntityType);
    if (!config) {
      throw new Error(`No active MappingConfiguration found for [${rawRecord.sourceSystemId}:${rawRecord.sourceEntityType}]`);
    }

    const payload = rawRecord.payload;
    const mappedData: Record<string, any> = {};
    const mappedSourceKeys = new Set<string>();

    if (rawRecord.payloadFormat === 'fhir-resource' || rawRecord.sourceSystemId === 'hospital-c') {
      return this.fhirMapper.map(rawRecord, config);
    }

    // Process each field mapping rule
    for (const rule of config.fieldMappings) {
      const rawValue = rule.sourceField.includes('.')
        ? rule.sourceField.split('.').reduce((o: any, k: string) => o?.[k], payload)
        : payload[rule.sourceField];
      mappedSourceKeys.add(rule.sourceField);

      let transformedValue = rawValue;

      // Stage 2: Transformation Engine
      if (rule.transformation && rawValue !== undefined) {
        transformedValue = this.transformEngine.transform(rule.transformation, rawValue, rule.transformParams);
      } else if (rawValue === undefined && rule.defaultValue !== undefined) {
        transformedValue = rule.defaultValue;
      }

      // Stage 3: Terminology Mapping
      if (rule.terminologyMapId && rawValue !== undefined) {
        const domain = config.targetCanonicalEntity === 'CanonicalCondition' ? 'DIAGNOSIS' :
                       config.targetCanonicalEntity === 'CanonicalObservation' ? 'LAB_TEST' :
                       config.targetCanonicalEntity === 'CanonicalMedicationRequest' ? 'MEDICATION' :
                       config.targetCanonicalEntity === 'CanonicalImmunization' ? 'VACCINE' : undefined;
        const clinicalCode: ClinicalCode = await this.terminologyService.resolveCode(
          String(rawValue),
          rawRecord.sourceSystemId,
          domain
        );
        this.setNestedProperty(mappedData, rule.targetField, clinicalCode);
        continue;
      }

      if (transformedValue !== undefined) {
        this.setNestedProperty(mappedData, rule.targetField, transformedValue);
      }
    }

    // Post-processing for MedicationRequest
    if (config.targetCanonicalEntity === 'CanonicalMedicationRequest' as any) {
      const rawMedCode = payload.كود_الدواء || payload.drug_code;
      if (!rawMedCode) throw new Error("Missing required field for MedicationRequest: drug code");
      
      const resolvedMedCode = await this.terminologyService.resolveCode(rawMedCode, rawRecord.sourceSystemId, 'MEDICATION');
      
      mappedData.medication = {
        internalId: rawRecord.sourceRecordId,
        code: resolvedMedCode,
        status: payload.status,
        form: payload.form,
        strength: payload.strength,
        manufacturer: payload.manufacturer
      };

      const sigText = payload.sig || payload.طريقة_الاستخدام;
      if (sigText) {
        mappedData.dosageInstruction = [
          {
            text: sigText,
            textAr: payload.طريقة_الاستخدام,
            timing: {
              frequency: payload.frequency,
              period: payload.period,
              periodUnit: payload.periodUnit
            },
            route: payload.route,
            doseQuantity: { value: Number(payload.الكمية || payload.qty), unit: payload.unit }
          }
        ];
      }

      mappedData.dispenseRequest = {
        numberOfRepeatsAllowed: Number(payload.التكرار_المسموح || payload.refills || 0),
        quantity: { value: Number(payload.الكمية || payload.qty), unit: payload.unit },
        expectedSupplyDurationDays: payload.supplyDays
      };
      mappedData.status = payload.status;
      mappedData.intent = payload.intent;
    }

    // Post-processing for Immunization
    if (config.targetCanonicalEntity === 'CanonicalImmunization' as any) {
      const rawVaxCode = payload.كود_اللقاح || payload.vax_code;
      if (!rawVaxCode) throw new Error("Missing required field for Immunization: vaccine code");
      
      const resolvedVaxCode = await this.terminologyService.resolveCode(rawVaxCode, rawRecord.sourceSystemId, 'VACCINE');
      
      mappedData.vaccineCode = resolvedVaxCode;
      mappedData.lotNumber = payload.رقم_التشغيلة || payload.lot_no;
      mappedData.expirationDate = mappedData.expirationDate;
      mappedData.occurrenceDateTime = mappedData.occurrenceDateTime || payload.occurrenceDateTime;
      if (!mappedData.occurrenceDateTime) throw new Error("Missing required field for Immunization: occurrenceDateTime");
      mappedData.status = payload.status;
      mappedData.site = payload.مكان_الحقن || payload.admin_site;
      mappedData.route = payload.route;
    }

    // Post-processing for Allergy
    if (config.targetCanonicalEntity === 'CanonicalAllergyIntolerance' as any) {
      const rawSubstance = payload.المادة_المسببة || payload.allergen || payload.substance;
      if (!rawSubstance) throw new Error("Missing required field for Allergy: substance");
      
      const resolvedSubstanceCode = await this.terminologyService.resolveCode(rawSubstance, rawRecord.sourceSystemId, 'ALLERGY' as any);
      
      mappedData.substanceCode = resolvedSubstanceCode;
      mappedData.substanceText = payload.allergen || payload.المادة_المسببة;
      mappedData.substanceTextAr = payload.المادة_المسببة;
      mappedData.clinicalStatus = payload.clinicalStatus;
      mappedData.verificationStatus = payload.verificationStatus;
      mappedData.type = payload.type;
      mappedData.category = payload.category;
      mappedData.criticality = payload.criticality || (payload.درجة_الخطورة === 'شديدة' ? 'high' : undefined);
      mappedData.recordedDate = mappedData.recordedDate || payload.recordedDate;
      
      const reactionText = payload.التفاعل_التحسسي || payload.reaction_desc || payload.reactionText;
      if (reactionText) {
        mappedData.reactions = [
          {
            manifestationText: reactionText,
            manifestationTextAr: reactionText,
            manifestationCode: {
              snomedCode: reactionText.toLowerCase().includes('rash') ? '271807003' : '39579001',
              snomedDisplay: reactionText.toLowerCase().includes('rash') ? 'Skin eruption' : 'Anaphylaxis',
              sourceCode: 'REACTION-01',
              sourceDisplay: reactionText
            },
            severity: mappedData.criticality === 'high' ? 'severe' : 'moderate'
          }
        ];
      }
    }

    // Special handling for Claim / Bill items
    if (config.targetCanonicalEntity === 'CanonicalClaim' as any) {
      mappedData.sourceRecordId = rawRecord.sourceRecordId;
      mappedData.serviceProviderId = rawRecord.sourceSystemId;
      
      const rawServiceCode = payload.كود_الخدمة || payload.service_code;
      if (!rawServiceCode) throw new Error("Missing required field for Claim: service code");
      
      const serviceName = payload.اسم_الخدمة || payload.service_desc;
      const gross = mappedData.totalGrossSAR !== undefined ? mappedData.totalGrossSAR : payload.gross;
      const copay = mappedData.patientCopaySAR !== undefined ? mappedData.patientCopaySAR : payload.copay;
      if (gross === undefined || copay === undefined) throw new Error("Missing required fields for Claim: gross and copay amounts");
      const net = mappedData.netClaimedSAR !== undefined ? mappedData.netClaimedSAR : payload.net !== undefined ? payload.net : (gross - copay);

      mappedData.items = [
        {
          sequence: 1,
          serviceCode: {
            sourceCode: rawServiceCode,
            sourceSystem: `urn:${rawRecord.sourceSystemId}:services`,
            sbsCode: rawServiceCode,
            sbsDisplay: serviceName
          },
          serviceName,
          quantity: payload.qty,
          unitPriceSAR: gross,
          totalGrossSAR: gross,
          patientCopaySAR: copay,
          netClaimedSAR: net,
          patientInvoiceNo: rawRecord.sourceRecordId
        }
      ];
      mappedData.totalGrossSAR = gross;
      mappedData.totalPatientCopaySAR = copay;
      mappedData.totalInsurerClaimedSAR = net;
    }

    const unmappedFields = Object.keys(payload).filter(k => !mappedSourceKeys.has(k));

    return {
      rawRecordId: rawRecord.id,
      sourceSystemId: rawRecord.sourceSystemId,
      sourceRecordId: rawRecord.sourceRecordId,
      targetCanonicalEntity: config.targetCanonicalEntity,
      mappingConfigId: config.id,
      mappingVersion: config.mappingVersion,
      terminologyMapVersion: '1.0.0',
      data: mappedData,
      unmappedFields
    };
  }

  private async mapFhirResource(rawRecord: RawRecord, config: MappingConfiguration): Promise<MappedEntityResult> {
    return this.fhirMapper.map(rawRecord, config);
  }
}
