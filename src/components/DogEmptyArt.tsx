/**
 * Trois petites scènes canines dessinées en SVG (aucune image distante, aucun mouvement).
 * Couleurs : jetons --art-* de la charte (styles.css), lisibles en clair comme en sombre.
 * Décoratif par défaut (aria-hidden) ; passer `label` quand le dessin porte un sens.
 */
export type DogArt = "attentive" | "resting" | "playful";

const SCENES: Record<DogArt, string> = {
  // Chien assis, tête penchée, oreilles dressées : il cherche avec vous.
  attentive:
    '<circle class="g" cx="160" cy="34" r="10"/><path class="gk" d="M128 32l6-5M131 42h8M122 23l2-7"/><path class="lk" d="M30 124c2-10 0-18-4-24M38 124c0-8 3-14 8-18M22 124c-2-6-6-10-10-12M170 124c0-6 2-10 6-12M176 124c1-5 4-8 8-9"/><path class="l" d="M26 101c-8-2-12-8-12-14 8 0 13 6 12 14zM46 106c2-8 8-12 14-12-1 8-7 12-14 12z"/><path class="t" d="M120 116c14-2 22-10 20-24"/><path class="c" d="M78 122c-4-24 2-48 22-52 20 4 26 28 22 52z"/><path class="m" d="M100 74c-8 4-12 18-10 34h20c2-16-2-30-10-34z"/><path class="k" d="M95 104v17M105 104v17"/><ellipse class="m" cx="89" cy="122" rx="8" ry="4"/><ellipse class="m" cx="111" cy="122" rx="8" ry="4"/><path class="a" d="M86 69q14 8 28 0l1 5q-15 9-30 0z"/><circle class="g" cx="100" cy="79" r="3"/><g transform="rotate(-9 100 52)"><path class="s" d="M85 42l-6-23 16 13zM115 42l6-23-16 13z"/><ellipse class="c" cx="100" cy="50" rx="19" ry="17"/><ellipse class="m" cx="100" cy="60" rx="10" ry="7.5"/><ellipse class="i" cx="100" cy="56" rx="3.6" ry="2.6"/><path class="k" d="M100 59v2.5m-4 1q4 3 8 0"/><circle class="i" cx="92" cy="47" r="2.4"/><circle class="i" cx="108" cy="47" r="2.4"/><circle class="m" cx="92.8" cy="46.2" r=".8"/><circle class="m" cx="108.8" cy="46.2" r=".8"/></g>',
  // Chien enroulé sur son coussin, sous la lune : rien ne presse.
  resting:
    '<path class="g" d="M162 20a14 14 0 1 0 13 22 11 11 0 0 1-13-22z"/><path class="g" d="M138 28l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z"/><circle class="g" cx="182" cy="62" r="1.6"/><path class="gk" d="M110 56h8l-8 8h8M124 42h6l-6 6h6"/><path class="l" d="M32 120c0-10 30-14 68-14s68 4 68 14-30 12-68 12-68-2-68-12z"/><path class="c" d="M54 114c-4-18 14-30 46-30 30 0 52 10 52 26 0 6-4 8-10 8H62c-4 0-7-1-8-4z"/><path class="s" d="M104 87c20 0 38 6 44 16-12-6-28-9-44-8z"/><path class="k" d="M122 100c10 2 14 10 12 18"/><path class="t" d="M148 112c6 8-8 10-26 8"/><ellipse class="c" cx="64" cy="100" rx="21" ry="16"/><path class="s" d="M72 87c10-2 16 8 12 20-6-4-12-10-12-20z"/><ellipse class="m" cx="50" cy="106" rx="10" ry="7"/><ellipse class="i" cx="42" cy="104" rx="3" ry="2.4"/><path class="k" d="M56 97q4 3 8 0"/><path class="a" d="M78 90q5 10 2 22l-4-1q2-10-2-20z"/><ellipse class="m" cx="68" cy="117" rx="12" ry="4.5"/><ellipse class="m" cx="90" cy="118" rx="10" ry="4"/>',
  // Chien qui invite au jeu, balle à l'avant : on s'y met ensemble.
  playful:
    '<path class="gk" d="M168 44l8-6M170 56h9M162 32l4-8"/><path class="lk" d="M112 124c0-6 2-10 6-12M182 124c0-8-3-12-7-14M20 124c0-5-2-8-5-10"/><path class="t" d="M136 94l4 25M150 92l6 25M152 78c10-6 14-18 12-28"/><ellipse class="m" cx="141" cy="121" rx="7" ry="3.5"/><ellipse class="m" cx="157" cy="120" rx="7" ry="3.5"/><path class="c" d="M66 104c4-16 30-28 64-30 18-1 28 6 28 16 0 8-6 12-16 13-24 2-50 4-76 4z"/><path class="m" d="M84 105c16-5 38-7 56-6-18 4-38 6-56 6z"/><path class="c" d="M48 112h38a5 5 0 0 1 0 10H48a5 5 0 0 1 0-10z"/><ellipse class="m" cx="48" cy="117" rx="7" ry="5"/><path class="k" d="M60 117h22"/><path class="a" d="M77 84q5 10 0 20l-4-1q4-9 0-18z"/><path class="s" d="M52 83c-10-5-14 5-9 14 3-6 6-10 9-14z"/><circle class="c" cx="64" cy="94" r="17"/><path class="s" d="M70 80c4-14 16-16 21-10-7 2-13 8-15 16z"/><ellipse class="m" cx="52" cy="101" rx="10" ry="7"/><ellipse class="i" cx="44" cy="98" rx="3" ry="2.4"/><path class="k" d="M46 104q6 6 12 1"/><circle class="i" cx="60" cy="90" r="2.4"/><circle class="i" cx="71" cy="90" r="2.2"/><circle class="m" cx="60.8" cy="89.2" r=".8"/><circle class="g" cx="28" cy="114" r="10"/><path class="k" d="M20 109q8 6 16 0"/>',
};

const BACKDROP = '<ellipse class="bg" cx="100" cy="76" rx="90" ry="60"/><ellipse class="gr" cx="100" cy="125" rx="66" ry="6"/>';

export function DogEmptyArt({ art, label, className }: { art: DogArt; label?: string | undefined; className?: string | undefined }) {
  return (
    <svg
      viewBox="0 0 200 140"
      className={`dog-art ${className ?? ""}`}
      data-decorative={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: BACKDROP + SCENES[art] }}
    />
  );
}
