const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ text: "Erreur : La clé GEMINI_API_KEY n'est pas configurée sur Vercel." });
  }

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow.
Ton objectif : Créer un carnet percutant, très aéré, visuel et sans blabla inutile.

STRUCTURE OBLIGATOIRE DU CARNET :

1. L'ESSENTIEL EN UN COUP D'ŒIL
Rédige un court paragraphe de 3 lignes maximum qui résume l'esprit du voyage, la faisabilité et l'ambiance globale selon les envies : ${style || 'Découverte'}.

2. FICHE TECHNIQUE DU VOYAGE (Puces synthétiques)
- Budget maîtrisé : ${budget}€ au total (soit environ ${Math.round(budget/duree)}€/jour) en mode ${confort}.
- Trajet A/R : Vols/trains optimisés depuis ${depart || 'Paris'} vers ${destination}.
[Réserver mon transport](https://www.skyscanner.fr/transport/vols/${depart || 'PAR'}/${destination}/${date || '2026-06-01'})
- Hébergement sélectionné : Nom de l'établissement choisi, quartier stratégique et ambiance.
[Réserver l'hôtel](https://www.booking.com/searchresults.html?ss=HOTEL+${destination})
- Déplacements sur place : Mode recommandé (scooter, Uber, collectivo, pass métro, etc.) avec estimation de coût.

3. MONUMENTS & INCONTOURNABLES
Liste 2 ou 3 sites majeurs ou expériences emblématiques à ne pas rater avec liens dédiés :
- Nom du monument / spot : Pourquoi c'est incontournable.
[Réserver l'entrée / visite](https://www.getyourguide.fr/s/?q=${destination})

4. LES TABLES SÉLECTIONNÉES PAR RNOW
Donne 3 adresses précises (bon rapport qualité/prix, street food pépite ou table d'ambiance) :
- Nom du restaurant : Spécialité à commander impérativement.

5. PLANNING JOUR PAR JOUR (Focus Activités & Rythme)
Pour chaque jour (Jour 1 à Jour ${duree}) :
- JOUR X : Nom de l'étape
Matin : Activité précise et astuce timing.
Après-midi : Exploration ou détente.
Lien activité si payant : [Réserver l'activité](https://www.getyourguide.fr/s/?q=ACTIVITE+${destination}) ou mention "Accès libre".
Logistique du jour : Précision sur le transport d'un point A à un point B.

6. LE CONSEIL RNOW (Secret d'initié)
Donne une astuce d'expert très précise, niche et peu connue des touristes (spot secret pour le coucher de soleil, horaire pour éviter la foule, coutume locale méconnue, coupe-file gratuit, arnaque locale à contourner). Ce conseil doit prouver l'expertise absolue de l'agence.

RÈGLES DE FORME STRICTES :
- Phrases courtes, directes et percutantes.
- Utilise une majuscule au début de chaque phrase.
- AUCUN gras markdown (**), AUCUN dièse (#), AUCUN astérisque (*).
- Laisse un espace propre entre chaque section.
  `;

  let promptFinal = "";
  if (type === "initial") {
    promptFinal = `Génère le carnet de voyage expert de ${duree} jours à ${destination}. ${instructionsRnow}`;
  } else {
    promptFinal = `Itinéraire actuel : "${ancienItineraire}". Ajuste-le selon cette demande : "${feedback}". ${instructionsRnow}`;
  }

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();

    if (listData.error) {
      return res.status(200).json({ text: "Erreur Google API : " + listData.error.message });
    }

    const validModel = listData.models?.find(m => 
      m.supportedGenerationMethods?.includes("generateContent") && 
      (m.name.includes("flash") || m.name.includes("gemini"))
    ) || listData.models?.[0];

    if (!validModel) {
      return res.status(200).json({ text: "Aucun modèle de génération disponible sur ce compte." });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 3800 }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ text: "Erreur lors de la génération : " + data.error.message });
    }

    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      return res.status(200).json({ text: "L'IA n'a retourné aucun contenu. Veuillez réessayer." });
    }

    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(200).json({ text: "Erreur technique de traitement : " + error.message });
  }
}
