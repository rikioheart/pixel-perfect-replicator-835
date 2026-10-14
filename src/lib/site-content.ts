// Contenus repris du site WordPress lavoixduchien.fr (pages Services, Éducation, Rééducation,
// Sport, Ateliers, Balades collectives, Bilan comportemental, Présentation) pour survivre à sa fermeture.
export type Service = { slug: string; title: string; summary: string; body: string[]; points?: string[] };

export const ZONES = ['Seine-et-Marne (77)', 'Loiret (45)', 'Yonne (89)', 'Essonne (91)'];

export const ABOUT = {
  founded: '24 juillet 2024',
  founders: ['Marie Bernier', 'Aurélien Ragot', 'Océane Ripoll'],
  intro:
    'L’association La Voix du Chien est née de la volonté de professionnels du secteur canin de proposer un accompagnement personnalisé aux propriétaires de chiens et à leurs compagnons, à travers une approche respectueuse et coopérative.',
  network:
    'Les membres échangent des conseils, partagent leurs expériences et travaillent ensemble sur des cas complexes : un réseau de professionnels solidaires au service de tous les acteurs du monde canin.',
};

export const SERVICES: Service[] = [
  {
    slug: 'bilan-comportemental',
    title: 'Bilan comportemental',
    summary: 'Un moment dédié à mieux comprendre la relation avec votre chien, préalable à toute activité.',
    body: [
      'Le bilan est une évaluation approfondie du comportement de votre chien, réalisée par un professionnel qualifié, pour déceler ses forces, ses besoins, ses défis et les causes possibles de ses comportements (stress, anxiété, peur…).',
      'Il est demandé avant de participer aux activités afin que chaque chien reçoive un accompagnement adapté. Réalisé avec l’un de nos partenaires, il n’est pas à refaire pour les autres activités.',
    ],
    points: ['Compréhension approfondie', 'Solutions adaptées', 'Prévention des difficultés futures', 'Meilleure qualité de vie partagée'],
  },
  {
    slug: 'education',
    title: 'Éducation',
    summary: 'Coopération, respect et écoute des besoins du chien, partenaire actif de ses apprentissages.',
    body: [
      'L’apprentissage se fait dans un cadre bienveillant pour renforcer la relation entre le chien et son gardien, en tenant compte de ses émotions et de son bien-être.',
      'Idéal pour les chiots comme pour les chiens qui rencontrent des difficultés (gestion émotionnelle, marche en laisse…).',
    ],
    points: ['Méthodes douces et personnalisées', 'Renforcement positif, sans coercition', 'Chaque chien est un individu à part entière'],
  },
  {
    slug: 'reeducation',
    title: 'Rééducation',
    summary: 'Aider le chien à retrouver son équilibre, à son rythme, avec une équipe pluridisciplinaire.',
    body: [
      'La rééducation aide le chien à modifier certains comportements liés à son passé, à sa génétique, à l’adaptation à notre société ou à une mauvaise compréhension de ses besoins, en respectant son seuil de tolérance émotionnelle.',
      'La durée varie de quelques semaines à plusieurs mois, parfois davantage. L’engagement du gardien est essentiel pour assurer la continuité des apprentissages.',
    ],
  },
  {
    slug: 'sport',
    title: 'Sports et activités ludiques',
    summary: 'Découvrir son chien sous un nouveau jour en lui laissant exprimer ses talents naturels.',
    body: ['Des séances pour renforcer la relation entre le chien et son gardien, dans le jeu et le plaisir partagé.'],
    points: ['Hoopers : parcours d’obstacles tout en douceur', 'Activités de flair et recherche d’objets', 'Mantrailing : suivre une piste humaine', 'Proprioception : équilibre et conscience corporelle'],
  },
  {
    slug: 'ateliers',
    title: 'Ateliers à thème',
    summary: 'Des moments conviviaux pour approfondir ses connaissances : communication, émotions, soins coopératifs…',
    body: [
      'Que vous soyez novice ou expérimenté, vous repartez avec des connaissances et des astuces concrètes, dans une atmosphère chaleureuse où chacun se sent accueilli et écouté.',
    ],
    points: ['Permis de détention pour chiens catégorisés', 'Émotions et langage canin', 'Communication corporelle de l’humain', 'Soins coopératifs'],
  },
  {
    slug: 'balades-collectives',
    title: 'Balades collectives',
    summary: 'Socialiser son chien dans un cadre sécurisé, accompagné d’un professionnel.',
    body: [
      'Rencontrer d’autres chiens est essentiel à leur développement social et émotionnel. Nos balades vont au-delà de la simple rencontre : un professionnel vous accompagne, vous et votre compagnon.',
    ],
    points: ['Comprendre le langage canin', 'Savoir quand intervenir', 'Conseils personnalisés'],
  },
];
