import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./RouteDetailView.vue', import.meta.url), 'utf8')

test('keeps upload button and paste zone as separate interactions', () => {
  const uploadPanel = source.match(/<section\s+class="detail-upload-panel"[\s\S]*?>/)?.[0] || ''
  const pasteZone = source.match(/<div\s+class="detail-paste-zone"[\s\S]*?<\/div>/)?.[0] || ''
  const uploadButton = source.match(/<button[\s\S]*?class="secondary-button detail-upload-button"[\s\S]*?<\/button>/)?.[0] || ''

  assert.ok(uploadPanel, 'detail upload panel should exist')
  assert.ok(!uploadPanel.includes('@click='), 'upload panel itself must not open the file picker')
  assert.ok(pasteZone.includes('tabindex="0"'), 'paste zone should be focusable')
  assert.ok(pasteZone.includes('@paste='), 'paste zone should handle paste events')
  assert.ok(!pasteZone.includes('triggerFilePicker'), 'paste zone must not open the file picker')
  assert.ok(uploadButton.includes('@click.stop="triggerFilePicker(place)"'), 'upload button should open file picker')
})
