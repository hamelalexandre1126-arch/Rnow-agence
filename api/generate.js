const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { depart, destination, budget, style, date, duree, hebergement, rythme } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // --- TON PROMPT INTÉGRAL SANS AUCUNE SIMPLIFICATION ET TON AMÉLIORÉ ---
  const promptFinal = `
Tu es l'expert-conteur de l'agence Rnow. Crée un voyage d'exception pour : ${destination}.
INFOS CLIENT :
- Ville de départ : ${depart}.
- Budget total par personne : ${budget}€ (Vols inclus).
- Style : ${style}.
- Date : Dès le ${date} pour ${duree} jours.
- Hébergement : ${hebergement}.
- Rythme : ${rythme}.

CONSIGNES DE STYLE CRUCIALES POUR LA MARQUE RNOW :
- Écris avec enthousiasme, élégance et chaleur. Donne envie !
- Utilise des EMOJIS premium et pertinents pour illustrer CHAQUE JOURNÉE (ex: ✈️, 🏨, 🍴, 🌊, 📍, ✨, 🌅).
- FAIS BEAUCOUP D'ESPACES (sauts de ligne) entre les paragraphes pour une lecture aérée et fluide.
- Les titres doivent être en MAJUSCULES simples.
- Pas de ** ni de #. Pas de texte en gras via des symboles.

STRUCTURE (11 POINTS) :
1. UTILISATION DES INFOS : Intègre ${depart}, ${budget}€, ${duree} jours, ${hebergement}, ${rythme}, ${style}. Si le budget est trop bas pour ${destination}, propose une alternative intelligente.

2. ORGANISATION DE A À Z : Inclus les vols depuis ${depart}, les transports, les logements, les activités et les assurances.

3. VÉRIFICATION DES PRIX : Tarifs RÉELLEMENT vérifiés sur internet pour le ${date}.

4. PROGRAMME JOUR PAR JOUR DÉTAILLÉ : Avec horaires indicatifs.

5. ACTIVITÉS : Nom précis, adresse, prix, durée, accès, réservation nécessaire et SITE OFFICIEL (URL).

6. TRANSPORTS LOCAUX : Mode, lieu, prix, fiabilité.

7. HÉBERGEMENT : Nom, adresse, prix, style ${hebergement}, points forts.

8. RESTAURANTS : 1 restaurant AUTHENTIQUE par jour (nom, spécialité, adresse, budget).

9. ASSURANCE VOYAGE : Options adaptées à ${destination}.

10. LOCATION VOITURE : Si utile (compagnie, prix).

11. EXPÉRIENCE CLÉ EN MAIN : Le client ne doit rien chercher d'autre. Tout est prêt.

Termine par une section "MES CONSEILS VOYAGES" avec des astuces d'expert sur la culture locale.
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

    // --- LE NETTOYEUR RADICAL SANS COMPROMIS ---
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
