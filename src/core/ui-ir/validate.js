import fs from 'fs';
import Ajv from 'ajv';
const schema = JSON.parse(fs.readFileSync('src/core/ui-ir/ui-ir-schema.json','utf-8'));
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateFn = ajv.compile(schema);
export function validateIR(ir){
  const ok = validateFn(ir);
  return { ok, errors: ok? [] : validateFn.errors };
}
