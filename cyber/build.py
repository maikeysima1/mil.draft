#!/usr/bin/env python3
"""Builds cyber-experiment.html: a single self-contained page (CyberHire experiment). Reuses the shared stylesheet."""
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
html = """<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#0F1B35"><title>CyberHire – ניסוי</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>""" + rd('public/style.css') + rd('cyber/extra.css') + """</style></head>
<body><div id="app"></div><div id="toast" role="status" aria-live="polite"></div>
<script>""" + rd('cyber/app.js').replace('</script', '<\\/script') + """</script>
</body></html>
"""
out = os.path.join(root, 'cyber-experiment.html')
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html) // 1024, 'KB')
