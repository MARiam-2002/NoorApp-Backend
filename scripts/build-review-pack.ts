/**
 * Scholar review pack (HTML, Arabic) for one learning section, from the generated, verified content.
 * Print it to PDF from a browser.
 *   npx tsx scripts/build-review-pack.ts prophet-stories out.html [fontsDir] [id1,id2,…]
 * The optional id list limits the pack to one batch (and leaves out the Nawawi titles page).
 * fontsDir (optional): a node_modules/@fontsource folder with noto-naskh-arabic, amiri and amiri-quran.
 */
import { writeFileSync } from 'node:fs';
import { LEARNING_COLLECTIONS_DATA } from '../src/shared/data/learning-content';

const [collectionId = 'prophet-stories', out = 'review-pack.html', fontsArg, onlyArg] = process.argv.slice(2);
const fonts = fontsArg && fontsArg !== '-' ? fontsArg : undefined;
const only = onlyArg ? new Set(onlyArg.split(',')) : null;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ar = (n: number) => String(n).replace(/[0-9]/g, d => String.fromCharCode(0x0660 + Number(d)));
const collection = LEARNING_COLLECTIONS_DATA.find(c => c.id === collectionId);
if (!collection) throw new Error('Unknown section ' + collectionId);
const nawawi = LEARNING_COLLECTIONS_DATA.find(c => c.id === 'nawawi-forty')!;
const items = collection.items.filter(i => !only || only.has(i.id));
if (only && items.length !== only.size) throw new Error('Unknown id in ' + onlyArg);
const face = (family: string, file: string, weight = 400) => fonts ? `@font-face{font-family:${family};src:url(file://${fonts}/${file});font-weight:${weight}}` : '';
const box = '<div class="box"><b>رأي المراجِع:</b> ☐ موافق &nbsp;&nbsp; ☐ موافق بعد التعديل &nbsp;&nbsp; ☐ غير موافق<div class="lines">الملاحظات:</div><div class="sign">الاسم: ____________ &nbsp;&nbsp; التاريخ: ____________</div></div>';

let html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Noor review pack</title><style>
${face('Naskh', 'noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2')}${face('Naskh', 'noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff2', 700)}
${face('QuranF', 'amiri-quran/files/amiri-quran-arabic-400-normal.woff2')}${face('AmiriF', 'amiri/files/amiri-arabic-400-normal.woff2')}
@page{size:A4;margin:16mm 15mm}
body{font-family:Naskh,'Noto Naskh Arabic',serif;font-size:11.5pt;line-height:1.85;color:#1a1530}
h1{font-size:20pt;margin:0 0 6px}h2{font-size:16pt;border-bottom:2px solid #9c7a33;padding-bottom:4px;margin-top:0}h3{font-size:12.5pt;margin:14px 0 4px;color:#3a2f6b}
.cover{page-break-after:always}.story{page-break-before:always}
.ayah{font-family:QuranF,AmiriF,'Amiri Quran',serif;font-size:14pt;line-height:2.2;background:#f7f3e8;border-right:3px solid #9c7a33;padding:6px 12px;margin:6px 0}
.ref{font-family:Naskh,serif;font-size:9.5pt;color:#6b6585}
.hadith{font-family:AmiriF,Amiri,serif;font-size:12.5pt;background:#eef3f0;border-right:3px solid #2f8a68;padding:6px 12px;margin:6px 0}
.reflect{background:#f2f0f8;padding:6px 12px;border-radius:6px;margin:6px 0}
.box{border:1.5px solid #555;border-radius:6px;padding:8px 12px;margin-top:14px;page-break-inside:avoid}.lines{height:70px;border-bottom:1px dashed #999;margin-top:6px}.sign{margin-top:8px}
table{border-collapse:collapse;width:100%;font-size:10.5pt}td,th{border:1px solid #bbb;padding:4px 6px;vertical-align:top}.small{font-size:9.5pt;color:#555}
</style></head><body>
<div class="cover"><h1>ملف مراجعة علمية</h1><p style="font-size:14pt">تطبيق «نور» — قسم «تعلّم مع نور»<br>${esc(collection.titleAr)}: ${items.map(i => esc(i.personAr ?? i.titleAr)).join('، ')}${collectionId === 'prophet-stories' ? ' عليهم السلام' : ''}${only ? '' : '<br>ومعه: عناوين الأربعين النووية'}</p>
<p class="small">المحتوى لا يُنشر للمستخدمين قبل موافقة المراجِع.</p>
<h3>منهج الإعداد</h3><ul>
<li>الآيات منقولة آليًا بنصها من نص المصحف المعتمد في التطبيق (الرسم العثماني)، وأرقامها مذكورة تحت كل مقطع.</li>
<li>الأحاديث من صحيحي البخاري ومسلم فقط، ونصها منقول آليًا من نسخة إلكترونية ثابتة، ويتحقق البرنامج من أن العبارة موجودة في الحديث بالرقم المذكور (ترقيم فتح الباري للبخاري، وترقيم محمد فؤاد عبد الباقي لمسلم).</li>
<li>السرد إعادة صياغة لما في الآيات والأحاديث المذكورة فقط، دون إسرائيليات أو أسماء أو تفاصيل لم ترد فيها.</li>
<li>«وقفة» تأمل تربوي من المُعِدّ، وليست تفسيرًا، وهي أولى ما يُراجَع.</li></ul>
<h3>المطلوب من المراجِع</h3><ol>
<li>صحة السرد ومطابقته للآيات والأحاديث المذكورة.</li><li>سلامة «الوقفات» والدروس المستفادة من أي خطأ عقدي أو تفسيري.</li>
<li>صحة أسئلة الاختبار وإجاباتها.</li><li>في الأربعين النووية: مناسبة العناوين، وهل يُضاف تنبيه على حكم بعض الأحاديث.</li></ol>
<p>يكتب المراجِع رأيه في المربع آخر كل قسم، ويمكنه الكتابة على الهوامش مباشرة.</p></div>`;
for (const s of items) {
  html += `<div class="story"><h2>${ar(s.order)}. ${esc(s.titleAr)}</h2><p><b>الملخص:</b> ${esc(s.summaryAr)}</p>`;
  for (const sec of s.sections) {
    html += `<h3>${ar(sec.index + 1)}) ${esc(sec.titleAr)}</h3>` + sec.paragraphsAr.map(p => `<p>${esc(p)}</p>`).join('');
    for (const q of sec.quran) html += `<div class="ayah">${q.verses.map(v => `${esc(v.textAr)} ﴿${ar(v.ayah)}﴾`).join(' ')}<div class="ref">[${esc(q.referenceAr)}]</div></div>`;
    for (const h of sec.hadith) html += `<div class="hadith">«${h.excerptsAr.map(esc).join(' … ')}»<div class="ref">${esc(h.sourceAr)}</div></div>`;
    if (sec.reflectionAr) html += `<div class="reflect"><b>وقفة:</b> ${esc(sec.reflectionAr)}</div>`;
  }
  html += `<h3>الدروس المستفادة</h3><ul>${s.keyPointsAr.map(k => `<li>${esc(k)}</li>`).join('')}</ul>`;
  html += `<h3>أسئلة الاختبار</h3><ol>${s.quiz.map(q => `<li>${esc(q.questionAr)}<br>${q.optionsAr.map((o, i) => (i === q.correctIndex ? '✔ ' : '✘ ') + esc(o)).join('<br>')}<br><span class="small">${esc(q.explanationAr)}</span></li>`).join('')}</ol>${box}</div>`;
}
if (!only) html += '<div class="story"><h2>عناوين الأربعين النووية</h2><p class="small">نص الأحاديث يُنقل كما أورده الإمام النووي مع تخريجه وحكمه، فالمطلوب مراجعة العناوين، وذكر أي حديث يُستحسن التنبيه على حكمه.</p><table><tr><th>#</th><th>العنوان المقترح</th><th>أول الحديث</th></tr>';
if (!only) for (const n of nawawi.items) html += `<tr><td>${ar(n.order)}</td><td>${esc(n.titleAr)}</td><td class="small">${esc(n.sections[0]!.nawawi[0]!.textAr.replace(/\s+/g, ' ').slice(0, 120))}…</td></tr>`;
html += only ? '</body></html>' : `</table>${box}</div></body></html>`;
writeFileSync(out, html);
console.log('Wrote ' + out);
