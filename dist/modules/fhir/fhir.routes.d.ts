import type { ICanonicalStore } from '../../persistence/canonical-store.interface.js';
import type { FhirR4Serializer } from '../../fhir/fhir-serializer.js';
export declare function createFhirRoutes(canonicalStore: ICanonicalStore & any, fhirSerializer: FhirR4Serializer, engine: any): import("express-serve-static-core").Router;
