import io, re
p='src/pages/suppliers.astro'
s=io.open(p,encoding='utf-8',newline='').read()
nl='\r\n' if '\r\n' in s else '\n'
# The whole-page empty state is gone: each band says for itself whether it has
# anything, so the four labels are always visible and the page always shows its
# shape.
head = nl.join([
 '      {live.length === 0 ? (',
 '        <p class="prov-empty">',
 '          <strong>Nothing listed yet.</strong> If you supply Dubai schools, the',
 '          form below is how you get on this page.',
 '        </p>',
 '      ) : (',
 '        <>',
])
assert head in s, 'empty head'
s=s.replace(head, '')
tail = re.search(r'\r?\n[ \t]*</>\r?\n[ \t]*\)\}\r?\n(?=\r?\n?[ \t]*<section class="panel prov-form")', s)
assert tail, 'closing of the ternary'
s = s[:tail.start()] + nl + s[tail.end():]
io.open(p,'w',encoding='utf-8',newline='').write(s)
print('  bands always render')
