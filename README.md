# Menja galetes

Una extensió per al Firefox que es menja la primera galeta abans que es desi, i et disfressa perquè els webs s'emportin dades falses.

És per a la intimitat: perquè els anunciants i els rastrejadors no et puguin seguir d'un web a l'altre ni d'una visita a l'altra. No és per amagar-se ni per enganyar ningú (vegeu [Què no fa](#què-no-fa)).

## Què fa

**Es menja la primera galeta.** Quan un web et vol posar una galeta de seguiment (`_ga`, `_fbp`, `_gcl_au`, `IDE` i una seixantena més), Menja galetes la reescriu abans que el Firefox la desi, i hi posa un identificador inventat amb la mateixa forma. El web no veu mai el teu identificador de debò, ni la primera vegada. Les galetes de funcionament (la cistella, l'idioma) es queden fins que tanques la pestanya, i aleshores se les menja totes, també les de `localStorage` i `IndexedDB`.

**Et disfressa.** Cada web veu un navegador diferent i coherent: un altre sistema (Windows o Mac), una altra ciutat del mateix país que la teva IP, un altre idioma i una altra zona horària (`Date`, `Intl`, `Temporal`, `toLocale*`), una altra pantalla i una altra targeta gràfica, i una empremta de canvas i d'àudio inventada. La disfressa és la mateixa cada vegada que tornes al mateix web, i diferent per a cada web.

La disfressa arriba també als llocs on els webs més espavilats van a buscar el navegador de debò:
- **Els marcs que la pàgina crea** (`iframe`, `window[0]`, `innerHTML`, `window.open`) es disfressen en el moment que es creen, abans que la pàgina els pugui llegir.
- **Els treballadors** (`Worker`, `SharedWorker` i service workers): els que són un fitxer reben la disfressa al començament de l'script mentre baixa, i els que la pàgina crea des d'un `blob:` es creen amb la disfressa a dins.

**IP falses on es pot.** Els scripts que pregunten la IP per WebRTC en reben una de falsa, i les peticions porten una IP falsa a `X-Forwarded-For`. La IP de la connexió és la real: una extensió no la pot canviar.

**Respon els avisos de galetes** (OneTrust, Cookiebot, Didomi, Usercentrics, Sourcepoint i altres): els accepta o els rebutja per tu, com triïs.

**Si la IP canvia de país** (per exemple, si encens una VPN), es posa una disfressa del país nou i se les menja totes, perquè el web no pugui lligar l'abans i el després.

## Què no fa

- **No amaga la IP de la connexió.** Quan hi ha un delicte, la policia demana la IP al web i el proveïdor d'internet diu de qui és. Menja galetes no ho impedeix, a propòsit.
- **No toca els comptes.** Si entres en un compte, el web sap qui ets.
- **Qualsevol banc, pagament o govern del món, amb la identitat real.** Els seus sistemes contra el frau han de funcionar, i això no es pot treure. Es reconeixen de quatre maneres:
  1. Pel nom del web: `.gov`, `.gob.xx`, `.gouv.xx`, `.go.jp`, `admin.ch`…, noms amb *bank*, *banc*, *banque*, *caixa*, *caja*, *Sparkasse*…, les marques dels bancs grans i una llista fixa (PayPal, Stripe, Redsys, Bizum, `gencat.cat`, `canada.ca`, `bund.de`…).
  2. Pel certificat del web: si l'organització és un banc, una entitat financera o una administració («Banco…», «Credit Union», «Ministerio…», «Government…»), el web es torna a demanar sense disfressa abans que es vegi.
  3. Pels sistemes contra el frau i de verificació d'identitat (ThreatMetrix, iovation, BioCatch, Forter, SEON, Onfido, Jumio, Veriff…): si una pàgina en carrega un, el web passa a anar sense disfressa.
  4. Per les pàgines amb contrasenya o targeta: el primer cop que un web en demana una, passa a anar sense disfressa. Així els sistemes contra el frau i contra els comptes robats (i contra qui torna amb un altre compte després que l'hagin expulsat) continuen funcionant.
- **Però als bancs i als governs, les galetes de tercers se les menja.** Les que hi posen Google, Facebook o els anunciants (també `_ga` i companyia) es canvien per falses i desapareixen en tancar la pestanya. Les del mateix banc (la sessió) i les dels pagaments i dels sistemes contra el frau no es toquen.
- **No s'amaga.** Un web atent pot notar que fas servir alguna cosa així.

## Com instal·lar-la

Mentre no estigui signada per Mozilla, s'instal·la com a complement temporal (s'esborra en tancar el Firefox):

1. Obre `about:debugging#/runtime/this-firefox`.
2. Clica «Carrega un complement temporal…» i tria `extensio/manifest.json`.

Cal el Firefox 128 o més nou.

## Com està feta

- `extensio/fons.js`: reescriu les `Set-Cookie` abans que es desin (`webRequest` bloquejant, que el Firefox manté a Manifest V2), posa la disfressa a les capçaleres i se les menja quan tanques la pestanya.
- `extensio/lib/pagina.js`: el codi que va a cada pàgina a `document_start`, abans que cap script del web. Toca els objectes de la pàgina amb les Xray del Firefox (`wrappedJSObject`, `exportFunction`).
- `extensio/lib/comu.js`: les peces comunes (llocs, galetes de seguiment, països i disfresses).
- `proves/prova.py`: obre un Firefox a part, sense finestra, amb un perfil temporal, i fa 81 proves contra un servidor local. Només fa servir Python i el protocol Marionette del Firefox: `python3 proves/prova.py`.

## Llicència

Tots els drets reservats. Pots instal·lar-la i fer-la servir, i llegir-ne el codi, però no modificar-la ni distribuir-ne versions modificades sense permís per escrit de l'autor. Vegeu [LICENSE](LICENSE).
