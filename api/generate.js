const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { depart, destination, budget, style, date, duree, hebergement, rythme } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const promptFinal = `
Tu es l'Expert-Concierge de l'agence Rnow. Ta mission est de concevoir un voyage d'exception, clé en main, avec une précision chirurgicale.

COORDONNÉES : 
Départ: ${depart} | Destination: ${destination} | Budget: ${budget}€ | Style: ${style} | Rythme: ${rythme}.

CONSIGNES DE STYLE (À RESPECTER ABSOLUMENT) :
- Écris avec enthousiasme et élégance. 
- Utilise un EMOJI AU DÉBUT DE CHAQUE LIGNE pour créer une liste visuelle scannable.
- FAIS BEAUCOUP D'ESPACES (sauts de ligne) entre chaque bloc d'info.
- INTERDICTION d'utiliser des astérisques (*) ou des dièses (#).
- Les titres doivent être en MAJUSCULES simples.

STRUCTURE OBLIGATOIRE :

✈️ TES VOLS SUR-MESURE
Détaille les vols réels (Aller/Retour) depuis ${depart} avec compagnies, horaires et escales. Inclus-les dans le budget.

📅 TON PROGRAMME JOUR PAR JOUR DÉTAILLÉ
Pour CHAQUE JOUR (du Jour 1 au Jour ${duree}), tu dois fournir :
📍 L'ACTIVITÉ RNOW : [Nom précis]. [Pourquoi c'est LE meilleur choix].
💰 PRIX & RÉSA : [Prix exact en €]. [Site officiel ou lieu précis d'achat].
🏠 TON REFUGE : [Nom de l'hôtel/Airbnb], [Adresse complète]. [Point fort unique].
🍴 LA TABLE RNOW : [Nom du resto], [Adresse]. [Le plat typique à commander].
🚕 TRANSPORT : [Trajet précis : taxi, bus, voiture]. [Coût estimé].

PLUS :
🛡️ ASSURANCES : Présente 2 options d'assurance adaptées.
🚗 LOCATION : Si le rythme est "${rythme}", donne les détails de location de voiture.
💡 LE CONSEIL D'INITIÉ : Une astuce de local exclusive pour finir en beauté.

RÈGLES D'OR :
- Pas de phrases vagues ("voyez sur place", "selon vos goûts"). Tu DÉCIDES pour le client.
- Pas de liens génériques (Google Trad, etc.). Uniquement du spécifique ou "Achat sur place".
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

    // --- NETTOYEUR RADICAL ---
    textOutput = textOutput.replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
