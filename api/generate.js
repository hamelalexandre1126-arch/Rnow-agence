const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { depart, destination, budget, style, date, duree, hebergement, rythme } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante dans Vercel." });

  // --- LE PROMPT RNOW LE PLUS PUISSANT ET PRÉCIS ---
  const promptFinal = `
Tu es l'expert absolu de l'agence de voyage Rnow. Ta mission est de concevoir un voyage d'exception, clé en main.

COORDONNÉES DU VOYAGE :
- Départ de : ${depart}
- Destination ou Continent : ${destination} (Si c'est un continent, choisis le meilleur pays selon le budget).
- Budget par personne : ${budget}€ (Vols inclus).
- Rythme : ${rythme} (Lent = 1 zone, Équilibré = 2-3 escales, Intense = Itinérant).
- Durée : ${duree} jours à partir du ${date}.
- Hébergement souhaité : ${hebergement}.
- Envies spécifiques : ${style}.

TU DOIS RESPECTER CES 11 POINTS DE STRUCTURE :

1. UTILISATION DES INFOS : Intègre chaque détail fourni. Si le budget est trop bas pour la destination, propose une alternative intelligente ou des astuces "low-cost" de luxe.

2. ORGANISATION DE A À Z : Inclus les vols depuis ${depart}, les transferts, les logements, les activités et les assurances.

3. VÉRIFICATION DES PRIX : Tous les tarifs (vols, hôtels, repas) doivent être RÉALISTES pour la période du ${date}. Précise ce qui est inclus ou non.

4. PROGRAMME JOUR PAR JOUR : Détaille chaque journée avec des horaires indicatifs (Matin, Midi, Après-midi, Soirée).

5. ACTIVITÉS PRÉCISES : Pour chaque escale, donne le NOM, l'adresse, le prix, la durée, le besoin de réservation et le LIEN vers le site officiel.

6. TRANSPORTS LOCAUX : Précise comment se déplacer (train, bus, tuk-tuk, location), où prendre les billets et le prix.

7. HÉBERGEMENT : Donne le nom de l'établissement, l'adresse exacte, le prix par nuit et pourquoi il correspond au style ${hebergement}.

8. RESTAURATION : Propose 1 restaurant AUTHENTIQUE par jour (nom, spécialité à goûter, adresse, budget).

9. ASSURANCE VOYAGE : Propose des options d'assurances adaptées à la destination.

10. LOCATION DE VOITURE : Si le rythme est "Intense", propose une location de voiture (compagnie, prix, conseils de conduite locaux).

11. EXPÉRIENCE CLÉ EN MAIN : Le client ne doit avoir aucune recherche à faire. Tout est prêt.

CONSIGNES DE STYLE :
- Utilise des EMOJIS (✈️, 🏨, 🍴, 🌊, 📍).
- FAIS BEAUCOUP D'ESPACES (sauts de ligne) entre les paragraphes pour une lecture fluide.
- PAS DE SYMBOLES (pas de **, pas de #). Utilise des MAJUSCULES pour les titres de section.
- Termine par une section "MES CONSEILS VOYAGES" avec des astuces d'expert sur la culture locale.
  `;

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent"));
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
    });

    const data = await response.json();
    let textOutput = data.candidates[0].content.parts[0].text;

    // Nettoyage final des symboles Markdown
    textOutput = textOutput.replace(/\*\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
