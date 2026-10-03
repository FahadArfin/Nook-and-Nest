import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

SCRIPT = Path(__file__).resolve().parents[1]/'scripts/catalog-realism-contact.py'
spec = importlib.util.spec_from_file_location('contact', SCRIPT)
contact = importlib.util.module_from_spec(spec) if SCRIPT.exists() else None
if contact:
    spec.loader.exec_module(contact)


class ContactTests(unittest.TestCase):
    def fixture(self, root, count=1):
        def record(name, data=None):
            file = root/name
            if data is not None:
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(data)
            raw = file.read_bytes()
            return {'path': name, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        items = []
        for n in range(count):
            model_id = 'table-'+str(n)
            item = {'id': model_id, 'name': 'Table '+str(n), 'category': 'Living', 'contractSha256': 'a'*64,
                    'outputs': {'receipt': f'assets-source/catalog-realism/receipts/{model_id}.json'}}
            outputs = {'glb': record(f'public/experiments/catalog-realism/models/{model_id}.glb', b'actual GLB'),
                       'sourceBlend': record(f'assets-source/catalog-realism/candidates/{model_id}.blend', b'editable source')}
            inputs = sorted(outputs.values(), key=lambda r: r['path'])
            input_hash = hashlib.sha256(json.dumps(inputs, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            config = {'version': 1}
            config_hash = hashlib.sha256(b'{"version":1}').hexdigest()
            renders = []
            for view in ('front', 'rear', 'detail', 'underside', 'clay'):
                name = f'assets-source/catalog-realism/renders/{model_id}/{view}.png'
                (root/name).parent.mkdir(parents=True, exist_ok=True)
                Image.new('RGB', (32, 24), (n*20, 40, 60)).save(root/name)
                renders.append({'view': view, **record(name), 'glbSha256': outputs['glb']['sha256'], 'inputSetSha256': input_hash, 'renderConfigSha256': config_hash})
            receipt = {'catalogId': model_id, 'inputContractSha256': item['contractSha256'], 'state': 'processed', 'outputs': outputs, 'inputs': [], 'renders': renders,
                       'renderBinding': {'inputs': inputs, 'beforeSha256': input_hash, 'afterSha256': input_hash, 'configurationSha256': config_hash, 'configuration': config, 'configurationJson': '{"version":1}'}}
            record(item['outputs']['receipt'], json.dumps(receipt).encode())
            items.append(item)
        manifest = {'version': 1, 'scope': 'beta-only', 'items': items, 'sourceInputs': []}
        record('assets-source/catalog-realism/catalog.json', json.dumps(manifest).encode())
        return items

    def test_six_rows_keep_order_and_bind_original_images_without_review(self):
        self.assertIsNotNone(contact, 'Contact sheet utility must be implemented')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            items = self.fixture(root, 7)
            result = contact.make_sheets(root, [i['id'] for i in reversed(items)], name='pilot')
            self.assertEqual(len(result), 2)
            first = json.loads((root/result[0]['manifest']).read_text())
            self.assertEqual(first['idOrder'], [i['id'] for i in reversed(items)][0:6])
            with Image.open(root/first['image']['path']) as sheet:
                self.assertEqual(sheet.size, (1600, 1660))
            self.assertEqual(first['state'], 'awaiting-explicit-review')
            self.assertEqual(first['models'][0]['renders'][0]['view'], 'front')
            receipt = json.loads((root/items[0]['outputs']['receipt']).read_text())
            self.assertNotIn('review', receipt)

    def test_changed_render_is_rejected_before_any_sheet_is_written(self):
        self.assertIsNotNone(contact, 'Contact sheet utility must be implemented')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            items = self.fixture(root)
            (root/'assets-source/catalog-realism/renders/table-0/detail.png').write_bytes(b'stale image')
            with self.assertRaisesRegex(ValueError, 'hash|bytes'):
                contact.make_sheets(root, [items[0]['id']], name='stale')
            self.assertFalse((root/'assets-source/catalog-realism/contact-sheets/stale-01.png').exists())

    def test_missing_view_and_stale_candidate_binding_fail_closed(self):
        self.assertIsNotNone(contact, 'Contact sheet utility must be implemented')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            items = self.fixture(root)
            file = root/items[0]['outputs']['receipt']
            receipt = json.loads(file.read_text())
            receipt['renders'].pop()
            file.write_text(json.dumps(receipt))
            with self.assertRaisesRegex(ValueError, 'five|view'):
                contact.make_sheets(root, ['table-0'])

    def test_contact_refuses_missing_configuration_text_and_semantic_drift(self):
        for mutation in [lambda binding:binding.pop('configurationJson'),
                         lambda binding:binding['configuration'].update(version=2),
                         lambda binding:binding.update(configurationJson='{"version":1.0}')]:
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory);items=self.fixture(root);file=root/items[0]['outputs']['receipt']
                receipt=json.loads(file.read_text());mutation(receipt['renderBinding']);file.write_text(json.dumps(receipt))
                with self.assertRaisesRegex(ValueError,'configuration|Configuration'):
                    contact.make_sheets(root,['table-0'])
                self.assertFalse((root/'assets-source/catalog-realism/contact-sheets').exists())


if __name__ == '__main__':
    unittest.main()
