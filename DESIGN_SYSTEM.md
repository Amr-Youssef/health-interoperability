# النظام التصميمي المرجعي - المنصة الوطنية للربط الصحي
# Design System Reference — Saudi Health Interoperability Platform v0.2.4

> **الهدف:** منع التصاميم الشاذة مستقبلاً عبر مرجع واحد ملزم. كل لون/مسافة/حافة يجب أن يأتي من هذا الملف عبر `var(--*)` — يمنع `#[0-9a-f]` و `rgba` الصلب و `border-radius:4/6/8px` في `public/index.html` و `public/app.js`.

**المرجع الكودي الوحيد:** `public/style.css:1-146` و `public/index.html:1-20` (الخطوط)

---

## 1. الفلسفة (Philosophy)

| المبدأ | التطبيق | المرجع |
|---|---|---|
| **Borderless مسطح** | لا حدود ملونة للكروت، `border:1px solid var(--m3-outline-variant)` وهو `transparent` في الثيمين، الاعتماد على التدرج اللوني للخلفيات فقط | `public/style.css:32-34` و `107-109` |
| **تباين معكوس للشريط الجانبي** | دارك: شريط أفتح `#303030` على خلفية `#121212` / فاتح: شريط داكن `#16171B` على خلفية `#E9EBF0` | `public/style.css:4-5` |
| **هندسة حادة** | كل الزوايا `0px` — ` --radius-sharp:0px` | `public/style.css:75` |
| **تدرج خلفيات** | `surface` → `surface-dim` → `surface-container-low` → `container` → `container-high` → `container-highest` | `public/style.css:13-18` و `88-93` |

---

## 2. التوكنات اللونية (Color Tokens)

### 2.1 الأسطح (Surfaces)

| Token | Dark (`:root`) | Light (`body.light-theme`) | الاستخدام |
|---|---|---|---|
| `--m3-surface` | `#121212` | `#E9EBF0` | خلفية الصفحة |
| `--m3-surface-dim` | `#0A0A0A` | `#DEE1E8` | خلفية عميقة |
| `--m3-surface-container-low` | `#191919` | `#EEF0F4` | آبار داخلية، حقول الإدخال |
| `--m3-surface-container` | `#262626` | `#FFFFFF` | الكروت الرئيسية |
| `--m3-surface-container-high` | `#2E2E2E` | `#F3F4F7` | رؤوس الكروت/الجداول |
| `--m3-surface-container-highest` | `#383838` | `#E5E8EE` | hover / أزرار ثانوية |

### 2.2 الشريط الجانبي (Inverted Sidebar)

| Token | Dark | Light |
|---|---|---|
| `--sidebar-bg` | `#303030` | `#16171B` |
| `--sidebar-item-hover` | `#3D3D3D` | `#222329` |
| `--sidebar-item-active` | `#454545` | `#2A2C34` |
| `--sidebar-on-surface` | `#FFFFFF` | `#FFFFFF` (دائماً أبيض لأن الشريط دائماً داكن) |

### 2.3 الألوان الدلالية (Semantic)

| Token | Dark | Light | المعنى |
|---|---|---|---|
| `--m3-primary` | `#059669` | `#059669` | إجراء أساسي / نجاح |
| `--m3-primary-light` | `#10B981` | `#047857` | أيقونات نجاح، شريط مصادقة |
| `--m3-on-primary` | `#FFFFFF` | `#FFFFFF` | نص على primary |
| `--m3-primary-container` | `#183325` | `#DCFCE7` | خلفية نجاح فاتحة |
| `--m3-on-primary-container` | `#A7F3D0` | `#14532D` | نص على primary-container |
| `--m3-secondary` | `#71717A` | `#475569` | مؤسسي / HMS |
| `--m3-secondary-container` | `#333338` | `#E2E8F0` | خلفية مؤسسي |
| `--m3-tertiary` | `#8B5CF6` | `#7C3AED` | سجل عام / وطني |
| `--m3-tertiary-container` | `#332540` | `#EDE9FE` | خلفية وطني |
| `--m3-warning` | `#D97706` | `#D97706` | تحذير |
| `--m3-warning-container` | `#3D2E1A` | `#FEF3C7` | خلفية تحذير |
| `--m3-error` | `#DC2626` | `#DC2626` | خطر / طوارئ |
| `--m3-error-container` | `#3D1C1C` | `#FEE2E2` | خلفية خطر |
| `--m3-on-surface` | `#FFFFFF` | `#111827` | نص أساسي |
| `--m3-on-surface-variant` | `#A3A3A3` | `#4B5563` | نص ثانوي |
| `--m3-on-surface-muted` | `#737373` | `#6B7280` | نص خافت |

**ممنوع:** `#0ea5e9`, `#0284c7`, `#0c4a6e`, `#6366f1`, `#B45309`, `#B91C1C`, `#E0F2FE`, `#F0F9FF`, `rgba(14,165,233,0.06)` — كلها استبدلت بـ `var(--m3-secondary/tertiary/...)` في `public/index.html:123,1575,1852` و `public/app.js:1736,2845`.

### 2.4 الشارات (Badges) — `public/style.css:1156`

| Class | Token |
|---|---|
| `.badge-info` | `secondary-container` |
| `.badge-success` | `primary-container` |
| `.badge-warning` | `warning-container` |
| `.badge-error` | `error-container` (مضاف حديثاً) |
| `.badge-purple` | `tertiary-container` |

---

## 3. الطباعة (Typography)

| العنصر | الخط | الوزن | المرجع |
|---|---|---|---|
| نص عربي أساسي | `IBM Plex Sans Arabic` → `Tajawal` | 400-800 | `public/style.css:164` و `public/index.html:11` |
| كود / أرقام | `JetBrains Mono` | 400-700 | `public/style.css:195` |
| عناوين | `1.55rem/800` للصفحة، `1.05rem/700` للكروت | - | `public/style.css:596,946` |
| تقرير PDF (استثناء) | `Cairo` | - | `public/style.css:1798` — فقط للطباعة الرسمية |

---

## 4. المسافات (Spacing) — مقياس 4px

- `gap: 4/8/12/14/16px` — `public/style.css:823,957` (metrics-grid 12px, sources-grid 14px)
- `padding: 12/14/16/18px` للكروت — `public/style.css:829`
- `margin-bottom: 16px` للفواصل — لا تستخدم قيم عشوائية مثل `10px` خارج المقياس

---

## 5. الحواف والظلال (Radii & Shadows)

| الخاصية | القيمة المرجعية | الممنوع |
|---|---|---|
| `border-radius` | `var(--radius-sharp)` = `0px` لكل عناصر الداشبورد | `8px/6px/4px/10px` (كانت في `public/index.html:123` و `public/style.css:2503` وتم توحيدها) — الاستثناء: `50%` للدائري فقط، و `3px` لكود inline قديم تم توحيده |
| `box-shadow` | `none` للكروت المسطحة، `0 20px 60px rgba(0,0,0,0.65)` فقط للمودال/التوست العائم `public/style.css:2216,1612` | `0 2px 12px var(--m3-*)` الملونة (أزيلت من `public/index.html:1444`) |
| `border` | `1px solid var(--m3-outline-variant)` (=transparent) للكروت — `public/style.css:32` | `1px solid #0ea5e9` الملون |

---

## 6. المكونات (Components)

### Card
```css
.card { background: var(--m3-surface-container); border-radius: var(--radius-sharp); }
.card-header { background: var(--m3-surface-container-high); padding:14px 18px; }
```

### Banner Info
```css
.banner-info { background: var(--m3-surface-container); border-right:4px solid var(--m3-primary); }
.banner-icon { background: var(--m3-surface-container-high); color: var(--m3-on-surface-variant); }
```
- لا تستخدم `background:var(--m3-primary-container)` أو `linear-gradient` — كانت شاذة في `public/index.html:1575`

### Metric Card
- الأيقونة: `.bg-blue → secondary-container`, `.bg-emerald → primary-container`, `.bg-cyan → #182C36/#E0F2FE` (مسموح كاستثناء مخبري)، `.bg-purple → tertiary-container`, `.bg-amber → warning-container` — `public/style.css:857`

### Button
- `btn-primary`: دارك `#EDEDED` / فاتح `#0F172A` — `public/style.css:747`
- `btn-secondary`: `var(--m3-surface-container-highest)` — لا تستخدم `border-color:#0284c7`

---

## 7. قواعد الاستخدام (Rules)

1. **لا هكس مباشر:** أي `#[0-9a-f]` في `public/index.html` أو `public/app.js` يعتبر شذوذ — استخدم `var(--m3-*)`. فحص: `grep -rn "#[0-9a-f]" public/index.html public/app.js` يجب أن يعيد 0 (باستثناء `#` نصي لجدول).
2. **لا rgba صلب:** استخدم `var(--m3-*-container)` بدل `rgba(14,165,233,0.06)`.
3. **لا radius صلب:** استخدم `var(--radius-sharp)`.
4. **الشريط الجانبي دائماً داكن:** نصه `var(--sidebar-on-surface)` أبيض في كلا الثيمين.
5. **الاستثناء الوحيد:** تقرير PDF `public/style.css:1750-2147` يستخدم `#1b5e20` (أخضر وزارة الصحة الرسمي) و `#cbd5e1` للطباعة — مسموح لأنه وثيقة ورقية بيضاء ثابتة، ليس داشبورد.

---

## 8. الفاتح / الداكن (Light/Dark)

- التبديل عبر `body.light-theme` و `[data-theme="light"]` — `public/style.css:85` و `public/app.js:658`
- كل توكن له قيمتان (دارك/فاتح) — لا تكتب لون ثابت بدون `var`.
- اختبار: بدّل الزر `public/index.html:520` وتأكد كل `var(--m3-*)` يتغير تلقائياً. شفافية `rgba(255,255,255,0.18)` للشارات على الشريط مسموحة لأن الشريط دائماً داكن.

---

## 9. المنع والتحقق (Enforcement)

```bash
# فحص سريع قبل كل commit
grep -rn "#[0-9a-fA-F]" public/index.html public/app.js | grep -v "الكتلة" && echo "❌ يوجد هكس شاذ"
grep -rn "border-radius:[[:space:]]*[0-9]px" public/index.html | grep -v "var(--radius" && echo "❌ يوجد radius شاذ"
grep -rn "rgba(" public/app.js | grep -v "rgba(255,255,255" && echo "❌ يوجد rgba شاذ"
npm run build # يجب أن ينجح
```

مقترح CI: إضافة `stylelint` قاعدة `color-no-hex: true` باستثناء `public/style.css` تعريفات التوكنات.

---

### Nav Group Label (مضاف)
- `.nav-group-label`: عنوان قسم باهت `0.66rem/700` بلون `var(--m3-on-surface-muted)` — `public/style.css` (كتلة CALM CHROME)، يُخفى تلقائياً عبر `syncNavGroups()` في `public/app.js` عندما لا يملك الدور الحالي أي زر ظاهر تحته.

## 10. سجل التوحيد الأخير (Changelog)

- **2026-09-12 (تهدئة):** تجميع القائمة في 5 أقسام مسماة، إخفاء بطاقة الجلسة المكررة (الهوية في شارة الهيدر)، سقف 3 تنبيهات مع منع التكرار خلال 4 ثوانٍ، إزالة تنبيه تبديل السمة الصاخب، تهدئة شارات الفوتر وحالة المحرك، حلقة `:focus-visible` موحدة — كلها بتوكنات `var(--*)` فقط.
- **2026-09-12 (تنظيف النطاقات):** سلم نقاط توقف متدرج `1280/1200/1024/768/640/480/380` + ارتفاع قصير، إزالة القوس الزائد (توازن الأقواس الآن تام)، حذف CSS الميت لبطاقة الجلسة، تعريف `mb-4` المفقود، التفاف كل ترويسات الأقسام والهيدر في كل الأحجام، تمرير أفقي لجداول `card-body.p-0` بدل قصّها، كثافة جدولية وسطى، `prefers-reduced-motion` شامل.

- **2026-08-31 (عميق):** توحيد 42+ هكس شاذ (أزرق سماوي/بنفسجي/عنبري) → توكنات، توحيد 10+ `border-radius` → `0px`، توحيد كل `card-header/banner` إلى `surface-container-high/surface`، إصلاح `public/app.js:1736` شارات الحرج → `badge-error` وإضافة `public/style.css:1188`.
- **الملفات المتأثرة:** `public/style.css:2507`, `public/index.html:123,190,1575,1852`, `public/app.js:45,2845,2876`

---

*هذا الملف هو المرجع الملزم — أي تصميم لا يتبعه يعتبر شاذاً ويجب رفضه في المراجعة.*
