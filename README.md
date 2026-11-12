# Menja galetes

Una extensió per al Firefox, el Vivaldi, el Chrome i el Brave que es menja la primera galeta abans que es desi, i et disfressa perquè els webs s'emportin dades falses.

És per a la intimitat: perquè els anunciants i els rastrejadors no et puguin seguir d'un web a l'altre ni d'una visita a l'altra. No és per amagar-se ni per enganyar ningú (vegeu [Què no fa](#què-no-fa)).

## Què fa

**Es menja la primera galeta.** Quan un web et vol posar una galeta de seguiment (`_ga`, `_fbp`, `_gcl_au`, `IDE` i una seixantena més), Menja galetes la reescriu abans que el Firefox la desi, i hi posa un identificador inventat amb la mateixa forma. El web no veu mai el teu identificador de debò, ni la primera vegada. Les galetes de funcionament (la cistella, l'idioma) es queden fins que tanques la pestanya, i aleshores se les menja totes.

**També es menja les galetes que no són galetes**, els altres llocs on un web pot guardar o fer viatjar el teu identificador:
- `localStorage`, `IndexedDB`, la memòria de l'API Cache i els *service workers*, en tancar la pestanya.
- Els identificadors dels enllaços (`fbclid`, `gclid`, `msclkid`, `igshid`, `utm_*`…), que es treuen de l'adreça abans que la pàgina carregui.
- Els ETag: als tercers no se'ls torna, perquè no puguin fer servir la memòria cau com una galeta.
- L'empremta del navegador, amb la disfressa (més avall).

**Et disfressa.** Cada web veu un navegador diferent i coherent: un altre sistema (Windows o Mac), una altra ciutat del mateix país que la teva IP, un altre idioma i una altra zona horària (`Date`, `Intl`, `Temporal`, `toLocale*`), una altra pantalla i una altra targeta gràfica, i una empremta de canvas i d'àudio inventada. La disfressa és la mateixa cada vegada que tornes al mateix web, i diferent per a cada web.

La disfressa arriba també als llocs on els webs més espavilats van a buscar el navegador de debò:
- **Els marcs que la pàgina crea** (`iframe`, `window[0]`, `innerHTML`, `window.open`) es disfressen en el moment que es creen, abans que la pàgina els pugui llegir.
- **Els treballadors** (`Worker`, `SharedWorker` i service workers): els que són un fitxer reben la disfressa al començament de l'script mentre baixa, i els que la pàgina crea des d'un `blob:` es creen amb la disfressa a dins.

**IP falses on es pot.** Els scripts que pregunten la IP per WebRTC en reben una de falsa, i les peticions porten una IP falsa a `X-Forwarded-For`. Aquestes IP surten sempre de l'espai que els proveïdors fan servir per dins (`100.64.0.0/10`): semblen d'una connexió de debò, però no són de ningú, i no poden apuntar cap persona. La IP de la connexió és la real: una extensió no la pot canviar.

**Webs de confiança.** Als que tu tries (per defecte, Google, YouTube, GitHub, Claude, Mozilla i Vivaldi) hi vas sense disfressa, i s'hi queden les seves galetes perquè no et tregui de la sessió. Les de tercers i les de seguiment, en canvi, se les menja igualment. La confiança només compta quan visites el web: si surt dins d'un altre (un vídeo de YouTube en un diari, un reCAPTCHA), és un tercer més.

**Respon els avisos de galetes** (OneTrust, Cookiebot, Didomi, Usercentrics, Sourcepoint i altres): els accepta o els rebutja per tu, com triïs.

**Es menja els gravadors de sessió.** Hotjar, Microsoft Clarity, FullStory i companyia graven on mous el ratolí, on cliques i què escrius, per mirar-ho després com un vídeo. Menja galetes no els deixa carregar ni enviar res: la sessió que graven és buida.

**Es menja els espies dels correus.** Molts correus de propaganda porten una imatge invisible que avisa qui l'ha obert, quan i des d'on (Mailchimp, SendGrid, Amazon SES, HubSpot…). Si el teu correu web les carrega directament, Menja galetes no les deixa carregar.

**Salta els rebots dels enllaços.** Facebook, Google, LinkedIn, Reddit i altres fan passar els enllaços per un comptador abans d'enviar-te on vols (`l.facebook.com/l.php?u=…`). Si l'enllaç porta el destí a dins, Menja galetes hi va directament i el comptador no se n'assabenta.

**Diu «no venguis les meves dades».** Envia el senyal GPC (`Sec-GPC: 1` i `navigator.globalPrivacyControl`) a tots els webs. A Califòrnia l'han de respectar per llei, i a Europa alguns webs ja ho fan.

**Es menja les galetes velles.** En instal·lar-la, protegeix les galetes que ja tenies, perquè no perdis cap sessió. Quan fa 30 dies que no vas a un web (o 90, o mai, com triïs), se'n menja les galetes. No toca les dels webs de confiança ni les dels bancs i els pagaments.

**T'ensenya el resum de la setmana.** A la finestreta surt quantes galetes s'ha menjat aquesta setmana i de quines empreses eren (Google, Meta, Microsoft…). Cada dilluns t'ho diu amb un avís.

**Pots provar la disfressa.** Des de la finestreta s'obre Cover Your Tracks, una prova de l'EFF que mira si el teu navegador es pot reconèixer. Per comparar, la pots fer també sense disfressa: durant 15 minuts, només en aquella prova.

**Si la disfressa trenca un web**, se la treu sola. Quan un web disfressat es torna a carregar sense parar (la mateixa adreça 5 vegades en 30 segons), a partir d'aquell moment hi vas amb el navegador de debò i t'avisa. Les galetes de seguiment i les de tercers, se les continua menjant.

**Si la IP canvia de país** (per exemple, si encens una VPN), es posa una disfressa del país nou i se les menja totes, perquè el web no pugui lligar l'abans i el després.

**«Menja-te-les totes ara».** Des de la finestreta, se les menja totes de cop i es posa una disfressa nova per a aquell web. Mentrestant, un mico (o l'ós rentador, si el tries a les opcions, a «Qui se les menja») entra saltant a la pàgina, agafa les galetes amb les mans (porten el nom de les galetes de seguiment que s'ha menjat d'aquell web) i se les menja a mossegades: en salten trossos, li cauen molles de la boca i es queden per terra. N'atrapa una al vol, diu «Tinc gana… no n'hi ha més?» i se'n va. Si el sistema demana menys moviment, només surt la bombolla.

## Què no fa

- **No et deixa fer-te passar per ningú.** La disfressa la inventa l'extensió, a l'atzar i diferent per a cada web. No es pot triar ni importar una disfressa, una empremta, una IP ni unes galetes, i no s'hi afegirà mai: és el que necessita qui vol suplantar la identitat d'una altra persona.
- **No amaga la IP de la connexió.** Quan hi ha un delicte, la policia demana la IP al web i el proveïdor d'internet diu de qui és. Menja galetes no ho impedeix, a propòsit.
- **No toca els comptes.** Si entres en un compte, el web sap qui ets.
- **Qualsevol banc, pagament o govern del món, amb la identitat real.** Els seus sistemes contra el frau han de funcionar, i això no es pot treure. Es reconeixen de quatre maneres:
  1. Pel nom del web: `.gov`, `.gob.xx`, `.gouv.xx`, `.go.jp`, `admin.ch`…, noms amb *bank*, *banc*, *banque*, *caixa*, *caja*, *Sparkasse*…, les marques dels bancs grans i una llista fixa (PayPal, Stripe, Redsys, Bizum, `gencat.cat`, `canada.ca`, `bund.de`…).
  2. Pel certificat del web: si l'organització és un banc, una entitat financera o una administració («Banco…», «Credit Union», «Ministerio…», «Government…»), el web es torna a demanar sense disfressa abans que es vegi.
  3. Pels sistemes contra el frau i de verificació d'identitat (ThreatMetrix, iovation, BioCatch, Forter, SEON, Onfido, Jumio, Veriff…): si una pàgina en carrega un, el web passa a anar sense disfressa.
  4. Per les pàgines amb contrasenya o targeta: el primer cop que un web en demana una, passa a anar sense disfressa. Així els sistemes contra el frau i contra els comptes robats (i contra qui torna amb un altre compte després que l'hagin expulsat) continuen funcionant.
- **Les xarxes socials, la missatgeria, les cites i les plataformes on hi ha menors, també amb la identitat real.** Instagram, TikTok, WhatsApp, Discord, Tinder, Roblox i la resta: és on passen l'assetjament i l'abús, i els seus sistemes contra els comptes falsos i contra qui torna després que l'expulsin han de funcionar.
- **Però als bancs, als governs i a les xarxes, les galetes de tercers se les menja.** Les que hi posen Google, Facebook o els anunciants (també `_ga` i companyia) es canvien per falses i desapareixen en tancar la pestanya. Les del mateix banc (la sessió) i les dels pagaments i dels sistemes contra el frau no es toquen.
- **No s'amaga.** Un web atent pot notar que fas servir alguna cosa així.

## Com instal·lar-la

A la pàgina de [versions](https://github.com/jordirelats/menja-galetes/releases) hi ha dos paquets a punt, que serveixen per a Linux, Windows i Mac:
- `menja-galetes-firefox-….zip`, per al Firefox.
- `menja-galetes-chromium-….zip`, per al Chrome, el Vivaldi, el Brave i l'Edge.

Si en fas servir un, salta't el pas de muntar-la, i on diu «la carpeta», tria la que surt en descomprimir el paquet (a Windows: botó dret → «Extreu-ho tot»). Al Firefox, pots triar el ZIP tal qual.

Per fer-los: `python3 eines/fes-paquets.py` (els deixa a `construit/paquets/`).

### Al Firefox

Mentre no estigui signada per Mozilla, s'instal·la com a complement temporal (s'esborra en tancar el Firefox):

1. Obre `about:debugging#/runtime/this-firefox`.
2. Clica «Carrega un complement temporal…» i tria `extensio/manifest.json`.

Cal el Firefox 128 o més nou.

### Al Vivaldi, el Chrome i el Brave

1. Munta-la: `python3 eines/construeix-chromium.py` (la deixa a `construit/menja-galetes-chromium/`).
2. Obre `vivaldi://extensions` (o `chrome://extensions`) i activa el **mode de desenvolupador**.
3. Clica «Carrega l'extensió desempaquetada» i tria la carpeta `construit/menja-galetes-chromium`.
4. Obre els **detalls** de Menja galetes i activa **«Permet els scripts d'usuari»**. Sense això no et pot disfressar (les galetes, se les menja igualment), i la finestreta t'ho recorda.

Instal·lada així, s'hi queda encara que tanquis el navegador. Si la tornes a muntar, clica el botó de tornar a carregar de l'extensió.

Al Chromium, l'extensió fa el mateix que al Firefox, amb aquestes diferències:
- **Les galetes de tercers no es desen mai** (s'eliminen a la xarxa), perquè el Chromium les comparteix entre tots els webs. Les dels bancs, pagaments i sistemes contra el frau sí.
- **Les galetes de seguiment que el web posa per capçalera es canvien per falses just després de desar-se**, no abans: el Chromium no deixa reescriure-les. Les que es posen per JavaScript (la majoria: `_ga`, `_fbp`…) sí que es canvien abans.
- **Els treballadors de fitxer i els service workers no es disfressen**; els que crea la pàgina mateixa (des d'un `blob:`), sí.
- **No es reconeixen els bancs pel certificat** (el Chromium no el deixa llegir). Es reconeixen pel nom, pels sistemes contra el frau i per les pàgines amb contrasenya o targeta.
- **La disfressa de les capçaleres va per pestanya**: la primera petició d'un web nou pot sortir amb la del web anterior. La de la pàgina sí que hi és des del principi.

## Com està feta

- `extensio/fons.js`: reescriu les `Set-Cookie` abans que es desin (`webRequest` bloquejant, que el Firefox manté a Manifest V2), posa la disfressa a les capçaleres i se les menja quan tanques la pestanya.
- `extensio/lib/pagina.js`: el codi que va a cada pàgina a `document_start`, abans que cap script del web. Toca els objectes de la pàgina amb les Xray del Firefox (`wrappedJSObject`, `exportFunction`).
- `extensio/lib/comu.js`: les peces comunes (llocs, galetes de seguiment, països i disfresses).
- `extensio/lib/monstre.js`: el mico i l'ós rentador (`MG_personatges()`; per afegir-ne un, n'hi ha prou amb el dibuix). Es posa a la pàgina només quan cliques «Menja-te-les totes ara», dins d'una *shadow root* tancada i amb `element.animate()`, perquè ni els estils ni la CSP del web el puguin tocar.
- `chromium/`: la versió per al Vivaldi, el Chrome i el Brave (Manifest V3). `fons.js` és un *service worker* que fa servir `declarativeNetRequest`, `userScripts` i `cookies`; `pagina.js` és el codi de pàgina (al món MAIN); `contingut.js` respon els avisos i detecta les pàgines amb contrasenya. La finestreta, les opcions i `lib/comu.js` són els mateixos del Firefox: `eines/construeix-chromium.py` ho ajunta tot.
- `proves/prova.py`: obre un Firefox a part, sense finestra, amb un perfil temporal, i fa 132 proves contra un servidor local. Només fa servir Python i el protocol Marionette del Firefox: `python3 proves/prova.py`.
- `proves/prova-chromium.mjs`: el mateix amb un Vivaldi a part (66 proves), controlat amb el protocol DevTools des del Node: `node proves/prova-chromium.mjs`. Amb `NAVEGADOR=chrome`, les fa amb el Google Chrome (que, des de la versió 137, s'hi carrega amb l'ordre `Extensions.loadUnpacked` del protocol).

Si un web no va bé amb l'extensió, `node proves/diagnostica.mjs <adreça>` l'obre en un Vivaldi a part, sense l'extensió i amb, i compara les recàrregues, els errors i les peticions que fallen.

## Llicència

Tots els drets reservats. Pots instal·lar-la i fer-la servir, i llegir-ne el codi, però no modificar-la ni distribuir-ne versions modificades sense permís per escrit de l'autor. Vegeu [LICENSE](LICENSE).
