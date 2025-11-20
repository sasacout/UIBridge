import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, 'ui-ir-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

const samplePath = process.env.UI_IR_FILE || path.join(process.cwd(), 'sample-ui-ir.json');
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(schema);

let data;
try {
  data = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
} catch (e) {
  console.error('[IR VALIDATOR] Failed to read UI IR file:', samplePath);
  console.error(e.message);
  process.exit(2);
}

const ok = validate(data);
if (!ok) {
  console.error('[IR VALIDATOR] Validation errors:');
  for (const err of validate.errors) {
    console.error(` - ${err.instancePath} ${err.message}`);
  }
  process.exit(1);
}
console.log('[IR VALIDATOR] UI IR valid. widgets:', data.widgets?.length ?? 0);
