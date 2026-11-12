/*
 * Menja galetes · el personatge de «Menja-te-les totes ara»: el mico o l'ós rentador (es tria a les
 * opcions; per defecte, el mico).
 *
 * Entra saltant, agafa una galeta amb cada mà, salta d'alegria i se les menja a mossegades: la
 * galeta es va fent petita, en salten trossos i li cauen molles de la boca. Salta fins a dues
 * galetes més i se les menja alternant les mans, n'atrapa una al vol («CRUUUNCH!»), es dona copets
 * a la panxa, diu «Tinc gana… no n'hi ha més?» i se'n va saltant. Les molles es queden per terra.
 * Les galetes porten el nom de les galetes de seguiment que s'ha menjat d'aquest web.
 *
 * MG_monstre({noms, personatge}) torna una promesa que s'acaba quan ha marxat (llavors el fons
 * torna a carregar la pàgina). Les opcions també el fan servir, per veure'l («Mira'l»).
 *
 * Funciona igual al Firefox (script de contingut) i al Chromium (món aïllat). No fa servir cap
 * full d'estil ni cap script en línia: els estils van per CSSOM, l'SVG només porta atributs de
 * presentació i les animacions són element.animate(), perquè la CSP del web no ho pugui bloquejar.
 * És dins d'una «shadow root» tancada, perquè els estils del web no el toquin. No toca la pàgina:
 * el sacseig del «CRUUUNCH!» és només de la capa del personatge (sacsejar <html> trencaria els
 * menús fixos). Aquest fitxer s'injecta cada vegada: a fora només hi ha declaracions de funció.
 *
 * Cada element té una «pista» que dura tota l'escena i totes comencen alhora.
 * Són personatges propis: en Jordi va triar el mico el 12/11/2026 entre tres (un ós rentador, un
 * mico i un pop) i després va voler poder triar-lo. La maqueta és maqueta/genera_personatges.py.
 */

// Els personatges. Tots comparteixen l'esquelet (viewBox 0 0 240 240): peus a y=234, boca a
// (120,112), ulls a (98,80) i (142,80), espatlles a (80,142) i (160,142) i la galeta a 64 de
// l'espatlla; i les classes p-… (p-bra-e, p-ulls-cors, p-boca-enorme, p-g-mossegada…).
// Per afegir-ne un: el dibuix, el nom i d'on penja la cua (en unitats del viewBox).
function MG_personatges() {
  return {
    mico: { nom: "El mico", cua: "150px 206px", svg: `
      <svg viewBox="0 0 240 240" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
      <mask id="mg-mico-mos" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-30" y="-30" width="60" height="60">
      <rect x="-30" y="-30" width="60" height="60" fill="#fff"/>
      <circle cx="-5" cy="-21" r="11" fill="#000"/>
      <circle cx="9" cy="-22" r="9" fill="#000"/>
      <circle cx="-17" cy="-13" r="8" fill="#000"/>
      </mask>
      <mask id="mg-mico-mitja" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-30" y="-30" width="60" height="60">
      <rect x="-30" y="-30" width="60" height="60" fill="#fff"/>
      <circle cx="0" cy="-10" r="17" fill="#000"/>
      <circle cx="-15" cy="-12" r="13" fill="#000"/>
      <circle cx="15" cy="-12" r="13" fill="#000"/>
      <circle cx="0" cy="-24" r="12" fill="#000"/>
      </mask>
      </defs>
      <g class="p-cua">
      <path d="M150 206 C196 220 228 186 214 152 C204 128 176 134 182 154 C186 166 200 160 198 150" stroke="#3A1F0C" stroke-width="16" fill="none" stroke-linecap="round"/>
      <path d="M150 206 C196 220 228 186 214 152 C204 128 176 134 182 154 C186 166 200 160 198 150" stroke="#8B5530" stroke-width="10" fill="none" stroke-linecap="round"/>
      </g>
      <g class="p-peu-e">
      <ellipse cx="100" cy="227" rx="21" ry="9" fill="#E3B183" stroke="#3A1F0C" stroke-width="3"/>
      </g>
      <g class="p-peu-d">
      <ellipse cx="140" cy="227" rx="21" ry="9" fill="#E3B183" stroke="#3A1F0C" stroke-width="3"/>
      </g>
      <g class="p-orelles">
      <circle cx="56" cy="86" r="23" fill="#8B5530" stroke="#3A1F0C" stroke-width="3.5"/>
      <circle cx="56" cy="86" r="13" fill="#F2D0A2"/>
      <circle cx="184" cy="86" r="23" fill="#8B5530" stroke="#3A1F0C" stroke-width="3.5"/>
      <circle cx="184" cy="86" r="13" fill="#F2D0A2"/>
      </g>
      <ellipse cx="120" cy="182" rx="50" ry="52" fill="#8B5530" stroke="#3A1F0C" stroke-width="3.5"/>
      <ellipse cx="120" cy="190" rx="32" ry="33" fill="#F2D0A2"/>
      <circle cx="120" cy="82" r="60" fill="#8B5530" stroke="#3A1F0C" stroke-width="3.5"/>
      <path d="M110 26 Q114 6 124 22 Q132 10 134 28" fill="#8B5530" stroke="#3A1F0C" stroke-width="3" stroke-linejoin="round"/>
      <path d="M120 58 C132 38 170 44 168 76 C168 102 152 130 120 132 C88 130 72 102 72 76 C70 44 108 38 120 58Z" fill="#F2D0A2" stroke="#3A1F0C" stroke-width="2.5"/>
      <g class="p-ulls-normal">
      <circle cx="98" cy="80" r="13" fill="#fff" stroke="#3A1F0C" stroke-width="2.5"/>
      <circle cx="142" cy="80" r="13" fill="#fff" stroke="#3A1F0C" stroke-width="2.5"/>
      <g class="p-nines">
      <circle cx="99" cy="82" r="8.1" fill="#160C04"/>
      <circle cx="143" cy="82" r="8.1" fill="#160C04"/>
      <circle cx="102" cy="78" r="3.2" fill="#fff"/>
      <circle cx="146" cy="78" r="3.2" fill="#fff"/>
      </g>
      </g>
      <g class="p-ulls-sorpresa" opacity="0">
      <circle cx="98" cy="80" r="16" fill="#fff" stroke="#3A1F0C" stroke-width="2.5"/>
      <circle cx="142" cy="80" r="16" fill="#fff" stroke="#3A1F0C" stroke-width="2.5"/>
      <circle cx="98" cy="80" r="4" fill="#160C04"/>
      <circle cx="142" cy="80" r="4" fill="#160C04"/>
      </g>
      <g class="p-ulls-cors" opacity="0">
      <path d="M98 91 C78 79 87 62 98 73 C109 62 118 79 98 91Z" fill="#FF3B5C" stroke="#3A1F0C" stroke-width="2.5"/>
      <path d="M142 91 C122 79 131 62 142 73 C153 62 162 79 142 91Z" fill="#FF3B5C" stroke="#3A1F0C" stroke-width="2.5"/>
      </g>
      <g class="p-ulls-contents" opacity="0">
      <path d="M86 84 Q98 68 110 84" stroke="#3A1F0C" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M130 84 Q142 68 154 84" stroke="#3A1F0C" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      </g>
      <g class="p-ulls-parpella" opacity="0">
      <path d="M86 78 Q98 88 110 78" stroke="#3A1F0C" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M130 78 Q142 88 154 78" stroke="#3A1F0C" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      </g>
      <g class="p-ulls-tancats" opacity="0">
      <path d="M87 71 L107 80 L87 89" stroke="#3A1F0C" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M153 71 L133 80 L153 89" stroke="#3A1F0C" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <ellipse cx="113" cy="98" rx="3.2" ry="4" fill="#5A341A"/>
      <ellipse cx="127" cy="98" rx="3.2" ry="4" fill="#5A341A"/>
      <g class="p-boca-somriure">
      <path d="M104 107 Q120 124 136 107" stroke="#3A1F0C" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
      <g class="p-boca-oberta" opacity="0">
      <path d="M103 106 Q120 101 137 106 Q135 128 120 130 Q105 128 103 106Z" fill="#5B1712" stroke="#3A1F0C" stroke-width="3.5"/>
      <path d="M108 124 Q120 114 132 124 Q120 132 108 124Z" fill="#FF7A8A"/>
      </g>
      <g class="p-boca-enorme" opacity="0">
      <ellipse cx="120" cy="116" rx="25" ry="23" fill="#5B1712" stroke="#3A1F0C" stroke-width="3.5"/>
      <path d="M106 131 Q120 120 134 131 Q120 140 106 131Z" fill="#FF7A8A"/>
      <rect x="110" y="94" width="9" height="9" rx="2" fill="#fff" stroke="#3A1F0C" stroke-width="2"/>
      <rect x="121" y="94" width="9" height="9" rx="2" fill="#fff" stroke="#3A1F0C" stroke-width="2"/>
      </g>
      <g class="p-boca-mastega" opacity="0">
      <path d="M102 112 Q111 103 120 112 Q129 121 138 110" stroke="#3A1F0C" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      </g>
      <g class="p-molles" opacity="0">
      <circle cx="100" cy="120" r="2.6" fill="#C98A4B"/>
      <circle cx="139" cy="117" r="2.2" fill="#8A5426"/>
      <circle cx="108" cy="127" r="1.8" fill="#8A5426"/>
      <circle cx="132" cy="126" r="2.4" fill="#C98A4B"/>
      <circle cx="96" cy="112" r="1.6" fill="#C98A4B"/>
      <circle cx="145" cy="108" r="1.8" fill="#C98A4B"/>
      </g>
      <g class="p-bra-e">
      <g transform="translate(80 142)">
      <path d="M0 0 L0 52" stroke="#3A1F0C" stroke-width="20" stroke-linecap="round"/>
      <path d="M0 0 L0 52" stroke="#8B5530" stroke-width="14" stroke-linecap="round"/>
      <g class="p-g-sencera" opacity="0" transform="translate(0 64) scale(1.3)">
      <g>
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <g class="p-g-mossegada" opacity="0" transform="translate(0 64) scale(1.3)">
      <g mask="url(#mg-mico-mos)">
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <g class="p-g-mitja" opacity="0" transform="translate(0 64) scale(1.3)">
      <g mask="url(#mg-mico-mitja)">
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <circle cx="0" cy="56" r="11" fill="#F2D0A2" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-6 63 v4 M0 64 v4 M6 63 v4" stroke="#3A1F0C" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      </g>
      <g class="p-bra-d">
      <g transform="translate(160 142)">
      <path d="M0 0 L0 52" stroke="#3A1F0C" stroke-width="20" stroke-linecap="round"/>
      <path d="M0 0 L0 52" stroke="#8B5530" stroke-width="14" stroke-linecap="round"/>
      <g class="p-g-sencera" opacity="0" transform="translate(0 64) scale(1.3)">
      <g>
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <g class="p-g-mossegada" opacity="0" transform="translate(0 64) scale(1.3)">
      <g mask="url(#mg-mico-mos)">
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <g class="p-g-mitja" opacity="0" transform="translate(0 64) scale(1.3)">
      <g mask="url(#mg-mico-mitja)">
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <circle cx="0" cy="56" r="11" fill="#F2D0A2" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-6 63 v4 M0 64 v4 M6 63 v4" stroke="#3A1F0C" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      </g>
      </svg>` },
    os: { nom: "L'ós rentador", cua: "160px 196px", svg: `
      <svg viewBox="0 0 240 240" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
      <mask id="mg-os-mos" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-30" y="-30" width="60" height="60">
      <rect x="-30" y="-30" width="60" height="60" fill="#fff"/>
      <circle cx="-5" cy="-21" r="11" fill="#000"/>
      <circle cx="9" cy="-22" r="9" fill="#000"/>
      <circle cx="-17" cy="-13" r="8" fill="#000"/>
      </mask>
      <mask id="mg-os-mitja" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-30" y="-30" width="60" height="60">
      <rect x="-30" y="-30" width="60" height="60" fill="#fff"/>
      <circle cx="0" cy="-10" r="17" fill="#000"/>
      <circle cx="-15" cy="-12" r="13" fill="#000"/>
      <circle cx="15" cy="-12" r="13" fill="#000"/>
      <circle cx="0" cy="-24" r="12" fill="#000"/>
      </mask>
      </defs>
      <g class="p-cua">
      <ellipse cx="163" cy="196" rx="17" ry="14" transform="rotate(0 163 196)" fill="#8F8E9C" stroke="#3A1F0C" stroke-width="3"/>
      <ellipse cx="183" cy="188" rx="17" ry="14" transform="rotate(-25 183 188)" fill="#45414F" stroke="#3A1F0C" stroke-width="3"/>
      <ellipse cx="199" cy="174" rx="17" ry="14" transform="rotate(-45 199 174)" fill="#8F8E9C" stroke="#3A1F0C" stroke-width="3"/>
      <ellipse cx="209" cy="156" rx="17" ry="14" transform="rotate(-65 209 156)" fill="#45414F" stroke="#3A1F0C" stroke-width="3"/>
      <ellipse cx="213" cy="136" rx="17" ry="14" transform="rotate(-80 213 136)" fill="#8F8E9C" stroke="#3A1F0C" stroke-width="3"/>
      <ellipse cx="212" cy="118" rx="17" ry="14" transform="rotate(-95 212 118)" fill="#45414F" stroke="#3A1F0C" stroke-width="3"/>
      </g>
      <g class="p-peu-e">
      <ellipse cx="100" cy="227" rx="21" ry="9" fill="#45414F" stroke="#3A1F0C" stroke-width="3"/>
      </g>
      <g class="p-peu-d">
      <ellipse cx="140" cy="227" rx="21" ry="9" fill="#45414F" stroke="#3A1F0C" stroke-width="3"/>
      </g>
      <g class="p-orelles">
      <path d="M58 62 L74 14 L100 50 Z" fill="#8F8E9C" stroke="#3A1F0C" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M67 52 L75 28 L89 47 Z" fill="#45414F"/>
      <path d="M182 62 L166 14 L140 50 Z" fill="#8F8E9C" stroke="#3A1F0C" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M173 52 L165 28 L151 47 Z" fill="#45414F"/>
      </g>
      <ellipse cx="120" cy="180" rx="54" ry="52" fill="#8F8E9C" stroke="#3A1F0C" stroke-width="3.5"/>
      <ellipse cx="120" cy="190" rx="33" ry="31" fill="#F1EEF5"/>
      <ellipse cx="120" cy="84" rx="66" ry="54" fill="#8F8E9C" stroke="#3A1F0C" stroke-width="3.5"/>
      <path d="M58 96 Q50 112 66 118 Q70 108 78 106Z M182 96 Q190 112 174 118 Q170 108 162 106Z" fill="#F1EEF5" stroke="#3A1F0C" stroke-width="2.5"/>
      <path d="M112 32 Q120 60 128 32 Q120 36 112 32Z" fill="#45414F"/>
      <path d="M56 78 C64 56 98 58 120 70 C142 58 176 56 184 78 C180 98 152 102 134 90 C127 86 113 86 106 90 C88 102 60 98 56 78Z" fill="#26232C"/>
      <ellipse cx="120" cy="110" rx="29" ry="21" fill="#F1EEF5" stroke="#3A1F0C" stroke-width="2.5"/>
      <g class="p-ulls-normal">
      <circle cx="98" cy="80" r="13" fill="#fff" stroke="#3A1F0C" stroke-width="2.5"/>
      <circle cx="142" cy="80" r="13" fill="#fff" stroke="#3A1F0C" stroke-width="2.5"/>
      <g class="p-nines">
      <circle cx="99" cy="82" r="8.1" fill="#160C04"/>
      <circle cx="143" cy="82" r="8.1" fill="#160C04"/>
      <circle cx="102" cy="78" r="3.2" fill="#fff"/>
      <circle cx="146" cy="78" r="3.2" fill="#fff"/>
      </g>
      </g>
      <g class="p-ulls-sorpresa" opacity="0">
      <circle cx="98" cy="80" r="16" fill="#fff" stroke="#3A1F0C" stroke-width="2.5"/>
      <circle cx="142" cy="80" r="16" fill="#fff" stroke="#3A1F0C" stroke-width="2.5"/>
      <circle cx="98" cy="80" r="4" fill="#160C04"/>
      <circle cx="142" cy="80" r="4" fill="#160C04"/>
      </g>
      <g class="p-ulls-cors" opacity="0">
      <path d="M98 91 C78 79 87 62 98 73 C109 62 118 79 98 91Z" fill="#FF3B5C" stroke="#3A1F0C" stroke-width="2.5"/>
      <path d="M142 91 C122 79 131 62 142 73 C153 62 162 79 142 91Z" fill="#FF3B5C" stroke="#3A1F0C" stroke-width="2.5"/>
      </g>
      <g class="p-ulls-contents" opacity="0">
      <path d="M86 84 Q98 68 110 84" stroke="#F1EEF5" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M130 84 Q142 68 154 84" stroke="#F1EEF5" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      </g>
      <g class="p-ulls-parpella" opacity="0">
      <path d="M86 78 Q98 88 110 78" stroke="#F1EEF5" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M130 78 Q142 88 154 78" stroke="#F1EEF5" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      </g>
      <g class="p-ulls-tancats" opacity="0">
      <path d="M87 71 L107 80 L87 89" stroke="#F1EEF5" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M153 71 L133 80 L153 89" stroke="#F1EEF5" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <ellipse cx="120" cy="96" rx="9" ry="6.5" fill="#1C1A20"/>
      <ellipse cx="117" cy="94" rx="3" ry="1.6" fill="#fff" opacity=".6"/>
      <g class="p-boca-somriure">
      <path d="M104 107 Q120 124 136 107" stroke="#3A1F0C" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
      <g class="p-boca-oberta" opacity="0">
      <path d="M103 106 Q120 101 137 106 Q135 128 120 130 Q105 128 103 106Z" fill="#5B1712" stroke="#3A1F0C" stroke-width="3.5"/>
      <path d="M108 124 Q120 114 132 124 Q120 132 108 124Z" fill="#FF7A8A"/>
      </g>
      <g class="p-boca-enorme" opacity="0">
      <ellipse cx="120" cy="116" rx="25" ry="23" fill="#5B1712" stroke="#3A1F0C" stroke-width="3.5"/>
      <path d="M106 131 Q120 120 134 131 Q120 140 106 131Z" fill="#FF7A8A"/>
      <rect x="110" y="94" width="9" height="9" rx="2" fill="#fff" stroke="#3A1F0C" stroke-width="2"/>
      <rect x="121" y="94" width="9" height="9" rx="2" fill="#fff" stroke="#3A1F0C" stroke-width="2"/>
      </g>
      <g class="p-boca-mastega" opacity="0">
      <path d="M102 112 Q111 103 120 112 Q129 121 138 110" stroke="#3A1F0C" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      </g>
      <g class="p-molles" opacity="0">
      <circle cx="100" cy="120" r="2.6" fill="#C98A4B"/>
      <circle cx="139" cy="117" r="2.2" fill="#8A5426"/>
      <circle cx="108" cy="127" r="1.8" fill="#8A5426"/>
      <circle cx="132" cy="126" r="2.4" fill="#C98A4B"/>
      <circle cx="96" cy="112" r="1.6" fill="#C98A4B"/>
      <circle cx="145" cy="108" r="1.8" fill="#C98A4B"/>
      </g>
      <g class="p-bra-e">
      <g transform="translate(80 142)">
      <path d="M0 0 L0 52" stroke="#3A1F0C" stroke-width="21" stroke-linecap="round"/>
      <path d="M0 0 L0 52" stroke="#8F8E9C" stroke-width="15" stroke-linecap="round"/>
      <g class="p-g-sencera" opacity="0" transform="translate(0 64) scale(1.3)">
      <g>
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <g class="p-g-mossegada" opacity="0" transform="translate(0 64) scale(1.3)">
      <g mask="url(#mg-os-mos)">
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <g class="p-g-mitja" opacity="0" transform="translate(0 64) scale(1.3)">
      <g mask="url(#mg-os-mitja)">
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <circle cx="0" cy="56" r="11" fill="#45414F" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-6 63 v4 M0 64 v4 M6 63 v4" stroke="#3A1F0C" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      </g>
      <g class="p-bra-d">
      <g transform="translate(160 142)">
      <path d="M0 0 L0 52" stroke="#3A1F0C" stroke-width="21" stroke-linecap="round"/>
      <path d="M0 0 L0 52" stroke="#8F8E9C" stroke-width="15" stroke-linecap="round"/>
      <g class="p-g-sencera" opacity="0" transform="translate(0 64) scale(1.3)">
      <g>
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <g class="p-g-mossegada" opacity="0" transform="translate(0 64) scale(1.3)">
      <g mask="url(#mg-os-mos)">
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <g class="p-g-mitja" opacity="0" transform="translate(0 64) scale(1.3)">
      <g mask="url(#mg-os-mitja)">
      <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
      <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
      <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
      <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
      <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
      <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
      </g>
      </g>
      <circle cx="0" cy="56" r="11" fill="#45414F" stroke="#3A1F0C" stroke-width="3"/>
      <path d="M-6 63 v4 M0 64 v4 M6 63 v4" stroke="#3A1F0C" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      </g>
      </svg>` },
  };
}

function MG_monstre(opcions) {
  const o = Array.isArray(opcions) ? { noms: opcions } : (opcions || {});
  const DURADA = 7700, TINTA = "#3A1F0C", FRASE = "Tinc gana… no n'hi ha més?";
  const DIST = 64, MIDA = 1.3;   // on té la galeta (des de l'espatlla) i com de grossa és
  const tots = MG_personatges();
  const def = tots[o.personatge] || tots.mico;

  const GALETA = `<svg viewBox="-26 -26 52 52" width="100%" height="100%" overflow="visible" aria-hidden="true">
    <g>
    <circle r="22" fill="#D9A15E" stroke="#3A1F0C" stroke-width="3"/>
    <path d="M-13 -9 q4 -7 11 -9" stroke="#F2CB91" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="-9" cy="-8" r="3.6" fill="#5A341A"/>
    <circle cx="8" cy="-12" r="3.2" fill="#5A341A"/>
    <circle cx="11" cy="6" r="3.8" fill="#5A341A"/>
    <circle cx="-6" cy="10" r="3.2" fill="#5A341A"/>
    <circle cx="-14" cy="4" r="2.6" fill="#5A341A"/>
    <circle cx="2" cy="-1" r="2.4" fill="#5A341A"/>
    </g>
    </svg>`;
  const TROS = [
    `<path d="M-9 -5 L6 -9 L9 4 L-2 9 L-8 3Z" fill="#D9A15E" stroke="${TINTA}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="1" cy="0" r="2.6" fill="#5A341A"/>`,
    `<path d="M-8 -8 L8 -4 L4 8 L-9 4Z" fill="#D9A15E" stroke="${TINTA}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="-1" cy="1" r="2.2" fill="#5A341A"/>`,
    `<path d="M-6 -9 L9 -2 L1 9 L-9 0Z" fill="#E2AE6C" stroke="${TINTA}" stroke-width="2.2" stroke-linejoin="round"/>`,
  ].map((d) => `<svg viewBox="-12 -12 24 24" width="100%" height="100%" overflow="visible" aria-hidden="true">${d}</svg>`);

  // Els noms de les galetes (els posa el fons; només lletres, xifres i _.-)
  const noms = (Array.isArray(o.noms) ? o.noms : []).map((n) => String(n).replace(/[^\w.-]/g, "")).filter(Boolean)
    .map((n) => (n.length > 12 ? n.slice(0, 11) + "…" : n));

  const contorn = (c, w) => "text-shadow:" + [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]]
    .map(([a, b]) => `${(a * w).toFixed(1)}px ${(b * w).toFixed(1)}px 0 ${c}`).join(",") + `,0 ${(w * 1.7).toFixed(1)}px 0 ${c};`;

  // ---- El motor: pista(el, [[ms, {x, y, r, s, sx, sy, o}, easing cap al punt següent], ...]) ----
  function motor(escena, W, H, T) {
    const S = Math.round(Math.max(80, Math.min(260, H * 0.4, W * 0.26)));
    const m = { W, H, T, S, sacsejades: [] };
    m.nou = (css, html, pare) => {
      const e = document.createElement("div");
      e.style.cssText = "position:absolute;left:0;top:0;" + (css || "");
      if (html) e.innerHTML = html;
      (pare || escena).appendChild(e);
      return e;
    };
    m.anima = (el, kf) => el.animate(kf, { duration: T, fill: "both" });
    const tf = (c) => `translate(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px) rotate(${c.r.toFixed(2)}deg) scale(${(c.s * c.sx).toFixed(3)},${(c.s * c.sy).toFixed(3)})`;
    m.pista = (el, punts) => {
      punts = punts.slice().sort((a, b) => a[0] - b[0]);
      const c = { x: 0, y: 0, r: 0, s: 1, sx: 1, sy: 1, o: 1 };
      Object.assign(c, punts[0][1]);
      const kf = [];
      if (punts[0][0] > 0) kf.push({ transform: tf(c), opacity: c.o, offset: 0, easing: "linear" });
      for (const [ms, p, e] of punts) {
        Object.assign(c, p);
        kf.push({ transform: tf(c), opacity: c.o, offset: Math.min(1, Math.max(0, ms / T)), easing: e || "ease-in-out" });
      }
      if (kf[kf.length - 1].offset < 1) kf.push({ transform: tf(c), opacity: c.o, offset: 1 });
      return m.anima(el, kf);
    };
    // Visible només durant els trams [[a, b], ...]
    m.visible = (el, trams) => {
      const kf = [{ opacity: 0, offset: 0 }];
      for (const [a, b] of trams.slice().sort((x, y) => x[0] - y[0])) {
        kf.push({ opacity: 0, offset: Math.max(0, a) / T }, { opacity: 1, offset: Math.max(0, a) / T },
          { opacity: 1, offset: Math.min(T, b) / T }, { opacity: 0, offset: Math.min(T, b) / T });
      }
      kf.push({ opacity: 0, offset: 1 });
      return m.anima(el, kf);
    };
    // Estats excloents (ulls, boca, galeta a la mà): seq = [[ms, nom], ...]
    m.estats = (grups, seq) => {
      seq = seq.slice().sort((a, b) => a[0] - b[0]);
      const trams = {};
      seq.forEach(([t, nom], i) => { const fi = i + 1 < seq.length ? seq[i + 1][0] : T + 1; (trams[nom] = trams[nom] || []).push([t, fi]); });
      for (const nom in grups) if (grups[nom]) m.visible(grups[nom], trams[nom] || []);
    };
    m.parla = (a, b, per = 130) => { const s = []; for (let t = a, i = 0; t < b; t += per, i++) s.push([t, i % 2 ? "somriure" : "oberta"]); s.push([b, "somriure"]); return s; };
    m.arc = (t0, t1, p0, p1, alt, n = 10) => {
      const r = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        r.push([t0 + (t1 - t0) * u, { x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u - alt * 4 * u * (1 - u) }, "linear"]);
      }
      return r;
    };
    // Un text de còmic que apareix d'un salt i puja una mica
    m.crit = (text, x, y, t0, dur, o = {}) => {
      const mida = o.mida || S * 0.15, puja = o.puja == null ? mida * 0.6 : o.puja;
      const a = m.nou(`left:${x}px;top:${y}px;width:0;height:0;`);
      const b = m.nou(`translate:-50% -50%;white-space:nowrap;font:900 ${mida.toFixed(1)}px/1 system-ui,sans-serif;` +
        `color:${o.color || "#fff"};letter-spacing:.02em;` + contorn(o.vora || TINTA, Math.max(2, mida / 9)), null, a);
      b.textContent = text;
      const r = o.rot || 0;
      m.pista(b, [[0, { o: 0, s: 0.2, r, y: 0 }], [t0, { o: 0, s: 0.2 }, "linear"], [t0 + 1, { o: 1, s: 0.3 }, "cubic-bezier(.2,1.6,.4,1)"],
        [t0 + 190, { s: 1, y: -puja * 0.3 }, "linear"], [t0 + dur - 160, { y: -puja * 0.85 }, "ease-in"], [t0 + dur, { o: 0, s: 1.15, y: -puja }]]);
      return b;
    };
    // La bombolla del que diu. (x, y) és la punta de la cua; costat: cap on s'obre.
    m.bombolla = (text, x, y, t0, t1, costat = "dreta") => {
      const mida = Math.max(12, Math.min(22, S * 0.105)), cua = mida * 0.95, bw = Math.max(2.5, mida / 6), ancora = mida * 1.3;
      const a = m.nou(`left:${x}px;top:${y}px;width:0;height:0;`);
      const dreta = costat === "dreta";
      const b = m.nou(`width:max-content;max-width:${Math.max(150, S * 1.35)}px;` +
        `translate:${dreta ? `${-ancora}px` : `calc(-100% + ${ancora}px)`} calc(-100% - ${cua - bw}px);` +
        `transform-origin:${dreta ? `${ancora}px` : `calc(100% - ${ancora}px)`} calc(100% + ${cua - bw}px);` +
        `font:800 ${mida}px/1.25 system-ui,sans-serif;color:${TINTA};background:#fff;border:${bw}px solid ${TINTA};` +
        `border-radius:${mida * 1.1}px;padding:${mida * 0.55}px ${mida * 0.85}px;box-shadow:0 ${bw * 1.6}px 0 ${TINTA};`, null, a);
      b.append(text);
      m.nou(`top:100%;${dreta ? `left:${ancora - bw}px` : `left:auto;right:${ancora - bw}px`};margin-top:${-bw}px;width:${cua}px;height:${cua}px;`,
        `<svg viewBox="0 0 ${cua} ${cua}" width="${cua}" height="${cua}" overflow="visible"><path d="${dreta ? `M${bw / 2} 0 L${bw / 2} ${cua - bw} L${cua} 0` : `M${cua - bw / 2} 0 L${cua - bw / 2} ${cua - bw} L0 0`}" fill="#fff" stroke="${TINTA}" stroke-width="${bw}" stroke-linejoin="round"/></svg>`, b);
      m.pista(b, [[0, { s: 0, o: 0 }], [t0, { s: 0, o: 0 }, "linear"], [t0 + 1, { s: 0.3, o: 1 }, "cubic-bezier(.2,1.5,.4,1)"],
        [t0 + 260, { s: 1 }, "linear"], [t1 - 150, { s: 1, o: 1 }, "ease-in"], [t1, { s: 0.6, o: 0 }]]);
      return b;
    };
    // Núvol de pols quan aterra
    m.pols = (x, y, t0, n = 4) => {
      for (let i = 0; i < n; i++) {
        const d = S * (0.12 + 0.05 * (i % 3));
        const e = m.nou(`width:${d}px;height:${d}px;margin:${-d / 2}px 0 0 ${-d / 2}px;border-radius:50%;background:#EFE4D3;border:2px solid #D3C1A6;box-sizing:border-box;`);
        const dx = (i - (n - 1) / 2) * S * 0.2, dy = -S * (0.05 + 0.04 * (i % 2));
        m.pista(e, [[0, { x, y, o: 0, s: 0.3 }], [t0, { x, y, o: 0, s: 0.3 }, "linear"], [t0 + 1, { x, y, o: 0.95, s: 0.4 }, "cubic-bezier(.2,.7,.4,1)"],
          [t0 + 480, { x: x + dx, y: y + dy, o: 0, s: 1.5 }]]);
      }
    };
    // Una cosa que cau amb gravetat, rebota una mica i es queda a terra
    m.cau = (el, t0, x0, y0, vx, vy, mida, gir = 0) => {
      const g = S * 9, sol = m.terra - mida - Math.random() * S * 0.025;
      const pts = [[0, { x: x0, y: y0, o: 0, r: 0 }], [t0, { x: x0, y: y0, o: 0, r: 0 }, "linear"], [t0 + 1, { x: x0, y: y0, o: 1, r: 0 }, "linear"]];
      let x = x0, y = y0, t = 0, r = 0, rebot = false;
      const dt = 0.035;
      while (t < 4) {
        t += dt; vy += g * dt; x += vx * dt; y += vy * dt; r += gir * dt;
        if (y >= sol) {
          y = sol;
          if (!rebot && vy > S * 2) { rebot = true; vy = -vy * 0.3; vx *= 0.5; gir *= 0.4; pts.push([t0 + t * 1000, { x, y, r }, "linear"]); continue; }
          pts.push([t0 + t * 1000, { x, y, r }, "linear"]);
          break;
        }
        pts.push([t0 + t * 1000, { x, y, r }, "linear"]);
      }
      m.pista(el, pts);
    };
    // Molles que cauen de la boca
    m.molles = (x, y, t0, n, forca = 1) => {
      for (let i = 0; i < n; i++) {
        const mida = S * (0.02 + Math.random() * 0.026);
        const e = m.nou(`width:${mida}px;height:${mida}px;border-radius:${i % 3 ? "50%" : "2px"};background:${["#C98A4B", "#B07436", "#8A5426", "#D9A15E"][i % 4]};`);
        const costat = i % 2 ? 1 : -1;
        m.cau(e, t0 + i * 18, x + costat * S * (0.03 + Math.random() * 0.05), y + S * 0.02,
          costat * S * (0.15 + Math.random() * 0.9) * forca, -S * (Math.random() * 1.2) * forca, mida, (Math.random() - 0.5) * 600);
      }
    };
    // Trossos de galeta que salten quan mossega
    m.trossos = (x, y, t0, n, forca = 1) => {
      for (let i = 0; i < n; i++) {
        const mida = S * (0.09 + Math.random() * 0.05);
        const e = m.nou(`width:${mida}px;height:${mida}px;margin:${-mida / 2}px 0 0 ${-mida / 2}px;`, TROS[i % TROS.length]);
        const costat = i % 2 ? 1 : -1;
        m.cau(e, t0, x, y, costat * S * (0.6 + Math.random() * 1.4) * forca, -S * (1.2 + Math.random() * 1.6) * forca, mida * 0.5, costat * (300 + Math.random() * 500));
      }
    };
    m.galeta = (C, etiqueta) => {
      const w = m.nou(`width:${C}px;height:${C}px;`);
      m.nou(`width:${C}px;height:${C}px;`, GALETA, w);
      if (etiqueta) {
        const e = m.nou(`left:50%;top:auto;bottom:100%;margin-bottom:${C * 0.08}px;translate:-50% 0;white-space:nowrap;` +
          `font:800 ${Math.max(9, C * 0.3)}px/1.25 ui-monospace,Menlo,Consolas,monospace;color:#fff;background:#5A341A;` +
          `border:2px solid ${TINTA};border-radius:999px;padding:0 ${Math.max(4, C * 0.14)}px;`, null, w);
        e.textContent = etiqueta;
      }
      return w;
    };
    m.personatge = (svg) => {
      const w = m.nou(`width:${S}px;height:${S}px;`);
      const cos = m.nou(`width:${S}px;height:${S}px;transform-origin:50% 97.5%;`, svg, w);
      const q = (s) => cos.querySelector(s);
      const vb = (el, o) => { if (el && o) { el.style.transformBox = "view-box"; el.style.transformOrigin = o; } return el; };
      const p = {
        w, cos,
        braE: vb(q(".p-bra-e"), "80px 142px"), braD: vb(q(".p-bra-d"), "160px 142px"),
        peuE: vb(q(".p-peu-e"), "100px 226px"), peuD: vb(q(".p-peu-d"), "140px 226px"),
        cua: vb(q(".p-cua"), def.cua), orelles: vb(q(".p-orelles"), "120px 70px"),
        nines: q(".p-nines"), molles: q(".p-molles"), ulls: {}, boques: {}, maE: {}, maD: {},
      };
      for (const n of ["normal", "sorpresa", "cors", "contents", "parpella", "tancats"]) p.ulls[n] = q(".p-ulls-" + n);
      for (const n of ["somriure", "oberta", "enorme", "mastega"]) p.boques[n] = q(".p-boca-" + n);
      for (const n of ["sencera", "mossegada", "mitja"]) { p.maE[n] = q(".p-bra-e .p-g-" + n); p.maD[n] = q(".p-bra-d .p-g-" + n); }
      return p;
    };
    // El sacseig: només de la capa del personatge
    m.fi = () => {
      if (!m.sacsejades.length) return;
      const p = [[0, { x: 0, y: 0 }]];
      for (const [t0, dur, amp] of m.sacsejades.sort((a, b) => a[0] - b[0])) {
        p.push([t0, { x: 0, y: 0 }, "linear"]);
        for (let t = t0 + 35, i = 0; t < t0 + dur; t += 35, i++) {
          const f = amp * (1 - (t - t0) / dur);
          p.push([t, { x: (i % 2 ? 1 : -1) * f, y: ((i >> 1) % 2 ? 1 : -1) * f * 0.6 }, "linear"]);
        }
        p.push([t0 + dur, { x: 0, y: 0 }, "linear"]);
      }
      m.pista(escena, p);
    };
    return m;
  }

  // ---- L'escena ----
  // Angles dels braços (graus): repòs, ajupir-se a terra, a la boca, amunt, a la panxa, enfora
  const BRA = { E: { repos: 12, terra: 45, boca: -127, amunt: 153, enfora: 70 }, D: { repos: -12, terra: -45, boca: 127, amunt: -153, panxa: 32, enfora: -70 } };

  function escena(m) {
    const { W, H, S, T } = m, k = S / 240;
    const terra = H - Math.max(3, S * 0.02);
    m.terra = terra;
    const C = 44 * MIDA * k;
    const P = (cx, alt = 0) => ({ x: cx - S / 2, y: terra - 234 * k - alt });
    const boca = (p) => ({ x: p.x + 120 * k, y: p.y + 112 * k });
    // On té la galeta quan s'ajup (amb el cos aixafat sx 1.05, sy .9) i quan aixeca el braç dret
    const rad = (g) => g * Math.PI / 180;
    const maTerra = (p, costat) => ({ x: p.x + (120 + (costat === "D" ? 1 : -1) * (40 + DIST * Math.sin(rad(45))) * 1.05) * k,
      y: p.y + (234 - (234 - 142 - DIST * Math.cos(rad(45))) * 0.9) * k });
    const maAmunt = (p) => ({ x: p.x + (160 + DIST * Math.sin(rad(153))) * k, y: p.y + (142 + DIST * Math.cos(rad(153))) * k });

    const xA = W * 0.66, xB = W * 0.3;
    const A = P(xA), B = P(xB), Bsalt = P(xB, S * 0.62);
    const fora = P(W + S * 0.7), mig = P(W * 0.86), surt1 = P(xB - W * 0.18), surt2 = P(-S * 0.8);

    // Les galetes de terra: salten a la mà quan les agafa
    const agafa = (nom, p, costat, tAgafa) => {
      const g = m.galeta(C, nom), c = maTerra(p, costat), s = { x: c.x - C / 2, y: terra - C };
      m.pista(g, [[0, s], [tAgafa - 90, s, "cubic-bezier(.4,0,.8,.5)"], [tAgafa, { x: c.x - C / 2, y: c.y - C / 2 - S * 0.02, o: 1 }, "linear"], [tAgafa + 1, { o: 0 }]]);
    };

    const p = m.personatge(def.svg);

    // --- On és el personatge
    const salt = (t0, t1, a, b, alt) => m.arc(t0, t1, a, b, alt);
    m.pista(p.w, [
      ...salt(0, 380, fora, mig, S * 0.4), [380, mig, "linear"],
      ...salt(430, 760, mig, A, S * 0.35), [760, A, "linear"],
      [1300, A, "linear"], ...salt(1300, 1650, A, A, S * 0.4), [1650, A, "linear"],
      [2950, A, "linear"], ...salt(2950, 3400, A, B, S * 0.6), [3400, B, "linear"],
      [4850, B, "cubic-bezier(.2,.8,.4,1)"], [5050, Bsalt, "cubic-bezier(.6,0,.8,.4)"], [5300, B, "linear"],
      [7100, B, "linear"], ...salt(7100, 7350, B, surt1, S * 0.32), ...salt(7380, 7650, surt1, surt2, S * 0.32),
    ]);
    // --- El cos: s'aixafa en aterrar, s'ajup, s'estira
    const aterra = (t) => [[t - 1, { sx: 1, sy: 1 }, "linear"], [t + 70, { sx: 1.16, sy: 0.84 }, "ease-out"], [t + 200, { sx: 1, sy: 1 }]];
    const ajup = (t0, t1) => [[t0, { sx: 1, sy: 1 }], [t1, { sx: 1.05, sy: 0.9 }], [t1 + 120, { sx: 1, sy: 1 }]];
    const mos = (t) => [[t - 1, { sx: 1, sy: 1 }, "linear"], [t + 40, { sx: 1.04, sy: 0.95 }], [t + 120, { sx: 1, sy: 1 }]];
    const mossegades = { D1: [1850, 1980, 2110], E1: [2400, 2530, 2660], rapides: [3830, 3990, 4140, 4290, 4440, 4590], gran: 5480 };
    m.pista(p.cos, [
      [0, { sx: 1, sy: 1, r: -8 }], [760, { r: -8 }, "linear"], ...aterra(380), ...aterra(760),
      [761, { r: 0 }], ...ajup(960, 1090), ...aterra(1650),
      ...[...mossegades.D1, ...mossegades.E1].flatMap(mos),
      [2950, { r: 0 }, "linear"], [3000, { r: -10 }], [3350, { r: -10 }], [3400, { r: 0 }], ...aterra(3400),
      ...ajup(3600, 3690), ...mossegades.rapides.flatMap(mos),
      [4750, { sx: 1, sy: 1 }], [4840, { sx: 1.1, sy: 0.82 }, "ease-out"], [4900, { sx: 0.92, sy: 1.12 }], [5040, { sx: 1, sy: 1 }],
      ...aterra(5300),
      [5479, { sx: 1, sy: 1 }, "linear"], [5520, { sx: 1.12, sy: 0.88 }], [5640, { sx: 0.96, sy: 1.05 }], [5760, { sx: 1, sy: 1 }],
      [7100, { r: 0 }], [7150, { r: 8 }], [7600, { r: 8 }],
    ]);
    // --- Els braços
    const anar = (t, a, e = "ease-in-out") => [t, { r: a }, e];
    const bE = BRA.E, bD = BRA.D;
    m.pista(p.braE, [
      anar(0, bE.amunt), anar(380, bE.amunt), anar(760, bE.repos), anar(880, bE.repos), anar(1080, bE.terra), anar(1110, bE.terra),
      anar(1300, bE.amunt), anar(1650, bE.amunt), anar(2000, bE.repos * 2), anar(2250, bE.repos * 2), anar(2370, bE.boca),
      anar(2700, bE.boca), anar(2850, bE.repos), anar(2950, bE.repos), anar(3150, bE.amunt), anar(3400, bE.amunt), anar(3480, bE.repos),
      anar(3500, bE.repos), anar(3680, bE.terra), anar(3720, bE.terra), anar(3830, bE.enfora),
      anar(3900, bE.enfora), anar(3965, bE.boca), anar(3995, bE.boca), anar(4060, bE.enfora),
      anar(4190, bE.enfora), anar(4260, bE.boca), anar(4295, bE.boca), anar(4360, bE.enfora),
      anar(4490, bE.enfora), anar(4560, bE.boca), anar(4600, bE.boca), anar(4700, bE.repos),
      anar(4750, bE.repos), anar(4850, bE.amunt), anar(5050, bE.amunt), anar(5300, bE.repos * 2),
      anar(7100, bE.repos), anar(7150, bE.amunt), anar(7650, bE.amunt),
    ]);
    const copets = [];
    for (let t = 5800, i = 0; t < 6500; t += 140, i++) copets.push(anar(t, i % 2 ? bD.panxa : bD.panxa + 14));
    m.pista(p.braD, [
      anar(0, bD.amunt), anar(380, bD.amunt), anar(760, bD.repos), anar(880, bD.repos), anar(1080, bD.terra), anar(1110, bD.terra),
      anar(1300, bD.amunt), anar(1650, bD.amunt), anar(1700, bD.amunt), anar(1820, bD.boca), anar(2120, bD.boca), anar(2350, bD.repos),
      anar(2950, bD.repos), anar(3150, bD.amunt), anar(3400, bD.amunt), anar(3480, bD.repos), anar(3500, bD.repos), anar(3680, bD.terra),
      anar(3720, bD.terra), anar(3800, bD.boca), anar(3835, bD.boca), anar(3900, bD.enfora),
      anar(4040, bD.enfora), anar(4110, bD.boca), anar(4145, bD.boca), anar(4210, bD.enfora),
      anar(4340, bD.enfora), anar(4410, bD.boca), anar(4445, bD.boca), anar(4520, bD.repos),
      anar(4750, bD.repos), anar(4850, bD.amunt), anar(5050, bD.amunt), anar(5300, bD.amunt), anar(5420, bD.boca), anar(5500, bD.boca),
      anar(5700, bD.panxa), ...copets, anar(6600, bD.panxa), anar(6800, bD.repos), anar(7100, bD.repos), anar(7150, bD.amunt), anar(7650, bD.amunt),
    ]);
    // --- Peus (en els salts), cua (tota l'estona) i orelles (quan veu galetes)
    const peu = (el, d) => m.pista(el, [[0, { y: 0, r: 0 }], ...[0, 430, 1300, 2950, 4850, 7100, 7380].flatMap((t) => [[t, { y: 0, r: 0 }, "ease-out"], [t + 120, { y: -8, r: d * 18 }, "ease-in"], [t + 300, { y: 0, r: 0 }]])]);
    peu(p.peuE, -1);
    peu(p.peuD, 1);
    const cua = [];
    for (let t = 0, i = 0; t <= T; t += 300, i++) cua.push([t, { r: i % 2 ? 10 : -6 }]);
    m.pista(p.cua, cua);
    m.pista(p.orelles, [[0, { r: 0 }], [880, { r: 0 }], [940, { r: -8 }], [1000, { r: 8 }], [1080, { r: 0 }], [4650, { r: 0 }], [4710, { r: -8 }], [4770, { r: 8 }], [4850, { r: 0 }]]);

    // --- Les galetes: dues aquí, dues allà i una que cau del cel
    agafa(noms[0], A, "E", 1100);
    agafa(noms[1], A, "D", 1100);
    agafa(noms[2], B, "E", 3700);
    agafa(noms[3], B, "D", 3700);
    const g5 = m.galeta(C, noms[4]), c5 = maAmunt(Bsalt);
    m.pista(g5, [[0, { x: c5.x - C / 2, y: -C * 3, r: 0, o: 1 }], [4150, { x: c5.x - C / 2, y: -C * 3, r: 0 }, "cubic-bezier(.45,0,.9,.5)"],
      [5050, { x: c5.x - C / 2, y: c5.y - C / 2, r: 340, o: 1 }, "linear"], [5051, { o: 0 }]]);
    // A les mans: sencera → mossegada → mitja → res
    m.estats(p.maD, [[0, "cap"], [1100, "sencera"], [1850, "mossegada"], [1980, "mitja"], [2110, "cap"],
      [3700, "sencera"], [3830, "mossegada"], [4140, "mitja"], [4440, "cap"], [5050, "sencera"], [5480, "cap"]]);
    m.estats(p.maE, [[0, "cap"], [1100, "sencera"], [2400, "mossegada"], [2530, "mitja"], [2660, "cap"],
      [3700, "sencera"], [3990, "mossegada"], [4290, "mitja"], [4590, "cap"]]);

    // --- Ulls i boca
    const totes = [...mossegades.D1, ...mossegades.E1, ...mossegades.rapides];
    m.estats(p.ulls, [[0, "normal"], [800, "sorpresa"], [1100, "cors"], [1700, "normal"], [1850, "contents"], [2800, "normal"],
      [2950, "contents"], [3400, "normal"], [3480, "sorpresa"], [3700, "cors"], [3820, "contents"], [4620, "normal"], [4680, "sorpresa"],
      [4900, "normal"], [5440, "tancats"], [5700, "contents"], [6400, "normal"], [6470, "parpella"], [6560, "normal"], [7100, "contents"]]);
    m.pista(p.nines, [[0, { x: 0, y: 0 }], [4620, { x: 0, y: 0 }], [4700, { x: 2, y: -5 }], [5050, { x: 2, y: -5 }], [5150, { x: 0, y: 0 }],
      [6560, { x: 0 }], [6650, { x: -5 }], [6850, { x: -5 }], [6950, { x: 5 }], [7100, { x: 0 }]]);
    m.estats(p.boques, [[0, "oberta"], [760, "somriure"], [800, "oberta"], [1100, "somriure"], [1300, "oberta"], [1650, "somriure"],
      ...totes.flatMap((t) => [[t - 110, "enorme"], [t, "mastega"]]), [2800, "somriure"], [3000, "oberta"], [3400, "somriure"],
      [4700, "oberta"], [5380, "enorme"], [5480, "mastega"], [5800, "somriure"], ...m.parla(5950, 6700), [7100, "oberta"]]);
    m.visible(p.molles, [[1850, T + 1]]);

    // --- Molles i trossos (es queden a terra)
    const bA = boca(A), bB = boca(B);
    for (const t of [...mossegades.D1, ...mossegades.E1]) { m.trossos(bA.x, bA.y, t, 2 + (t % 2)); m.molles(bA.x, bA.y, t, 10); }
    for (let t = 1900; t < 2800; t += 90) m.molles(bA.x, bA.y, t, 3, 0.45);
    for (const t of mossegades.rapides) { m.trossos(bB.x, bB.y, t, 2); m.molles(bB.x, bB.y, t, 8); }
    for (let t = 3850; t < 4700; t += 80) m.molles(bB.x, bB.y, t, 3, 0.45);
    m.trossos(bB.x, bB.y, mossegades.gran, 8, 1.2);
    m.molles(bB.x, bB.y, mossegades.gran, 26, 1.4);
    for (let t = 5550; t < 6600; t += 150) m.molles(bB.x, bB.y, t, 1, 0.3);
    m.sacsejades.push([mossegades.gran, 380, S * 0.045]);

    // --- Pols dels aterratges
    for (const [t, q] of [[380, mig], [760, A], [1650, A], [3400, B], [5300, B]]) m.pols(q.x + S / 2, terra - S * 0.03, t, 4);

    // --- Textos
    m.crit("!", xA, A.y - S * 0.02, 800, 450, { mida: S * 0.3, color: "#FFD23F" });
    const sons = ["NYAM!", "CRUNCH!", "CRAC!", "NYAM!", "CRUNCH!", "NYAM!"];
    totes.forEach((t, i) => {
      const b = i < 6 ? bA : bB, d = i % 2 ? 1 : -1;
      m.crit(sons[i % sons.length], b.x + d * S * (0.5 + 0.08 * (i % 3)), b.y - S * (0.42 + 0.07 * (i % 2)), t, 380, { mida: S * (i >= 6 ? 0.12 : 0.14), rot: d * 9 });
    });
    m.crit("!", xB, B.y - S * 0.02, 4680, 400, { mida: S * 0.3, color: "#FFD23F" });
    m.crit("CRUUUNCH!", bB.x + S * 0.15, bB.y - S * 0.75, mossegades.gran, 800, { mida: S * 0.26, color: "#FFD23F", rot: -7 });
    m.bombolla(FRASE, B.x + 176 * k, B.y + 70 * k, 5950, 7050, "dreta");
  }

  return new Promise((acaba) => {
    let host, fet = false;
    const plega = () => { if (fet) return; fet = true; try { host.remove(); } catch (e) { /* res */ } acaba(true); };
    try {
      const doc = document;
      host = doc.createElement("div");
      host.id = "menja-galetes-monstre";
      host.style.cssText = "all:initial;display:block;position:fixed;inset:0;z-index:2147483647;pointer-events:none;contain:strict;";
      const arrel = host.attachShadow ? host.attachShadow({ mode: "closed" }) : host;
      doc.documentElement.appendChild(host);
      const capa = doc.createElement("div");
      capa.style.cssText = "all:initial;display:block;position:absolute;inset:0;overflow:hidden;";
      arrel.appendChild(capa);
      const W = host.clientWidth || window.innerWidth, H = host.clientHeight || window.innerHeight;

      // Si el sistema demana menys moviment: només la bombolla, un moment.
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const m = motor(capa, W, H, 1800);
        m.bombolla(FRASE, Math.max(16, W / 2 - m.S * 0.6), H / 2 + 20, 0, 1800);
        setTimeout(plega, 1900);
        return;
      }
      const m = motor(capa, W, H, DURADA);
      escena(m);
      m.fi();
      setTimeout(plega, DURADA + 100);
    } catch (e) {
      plega();
    }
  });
}
