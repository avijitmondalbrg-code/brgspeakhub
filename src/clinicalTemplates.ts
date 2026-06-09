export interface ClinicalTemplate {
  diagnosis: string;
  concerns: string;
  findings: string;
  goals: string[];
  homeProgram: string;
  recommendations: string;
  frequency: string;
}

export const CLINICAL_TEMPLATES: Record<string, ClinicalTemplate> = {
  "Speech Sound Disorder (Articulation/Phonological)": {
    diagnosis: "Speech Sound Disorder (Articulation & Phonological Deficits)",
    concerns: "Difficulty putting words together clearly. Substitutes certain speech sounds (e.g., 't' for 'k', 'w' for 'r') which makes it hard for unfamiliar listeners to understand them.",
    findings: "Formal assessment (GFTA-3) reveals phonetic substitutions of /r/ -> [w] and /k/ -> [t] in word-initial positions. Intelligibility rating is around 60% in connected speech with unfamiliar peers. Phonological processes of fronting and gliding are evident.",
    goals: [
      "Improve phoneme placement and tactile cueing for accurate production of /r/ and /k/ sounds in isolation.",
      "Achieve 80% accuracy in producing initial /k/ and /g/ sounds at the single-word level.",
      "Maintain phonetic accuracy of targeted speech sounds inside structured reading tasks and short sentences.",
      "Generalize correct articulation of targeted speech sounds into spontaneous expressive conversation with caregivers."
    ],
    homeProgram: "Spend 5-10 minutes daily practicing high-repetition initial /k/ words ('cat', 'key', 'cup'). Encourage visual modeling using a mirror. Give prompt, positive reinforcement and avoid negative corrections.",
    recommendations: "1. Audiological evaluation to rule out any underlying hearing sensitivity issues.\n2. Consultation with preschool teacher regarding classroom sound-awareness games.\n3. Daily practice using the recommended speech exercises.",
    frequency: "2 sessions per week (45 minutes each)"
  },
  "Developmental Language Disorder": {
    diagnosis: "Developmental Language Disorder (Receptive & Expressive Deficits)",
    concerns: "Limited speech vocabulary, difficulty following directions at preschool or home, and struggle with organizing thoughts into a structured response.",
    findings: "Clinical evaluation (CELF-P3) indicates receptive-expressive language scores are in the 10th percentile. Patient struggles to follow 2-step instructions and has grammatical errors in word order. Mean Length of Utterance (MLU) is restricted to 2.2 words.",
    goals: [
      "Improve receptive language skills to follow complex 2-step verbal commands at home and school with 85% success.",
      "Expand expressive syntax by training use of auxiliary verbs (e.g., 'is', 'are') and plural markers.",
      "Increase functional MLU to 4.0 words during unstructured free-play assessments.",
      "Identify and label standard action verbs, colors, and spatial prepositions (e.g., 'on', 'under', 'next to') with minimal prompts."
    ],
    homeProgram: "Engage in shared interactive book reading. Describe activities in real-time (parallel talk). Provide choices to prompt responses (e.g., 'Do you want the blue crayon or the red crayon?').",
    recommendations: "1. Routine visual checking of instructional aids in school settings.\n2. Language-rich playgroups or interactive childcare.\n3. Continuous standard clinical speech stimulation support.",
    frequency: "2 sessions per week (30 minutes each)"
  },
  "Autism Spectrum Disorder (Social Pragmatics)": {
    diagnosis: "Autism Spectrum Disorder - Social Communication Deficits",
    concerns: "Difficulty initiating play with peers, inconsistent eye contact, challenges with conversational reciprocity, and narrow focus on specific topics.",
    findings: "Pragmatic Language Profile indicates challenges with joint attention, emotional regulation, and turn-taking. Restricted topic maintenance during group communication. Patient uses repetitive echolalic phrases when feeling anxious.",
    goals: [
      "Incorporate joint attention triggers to sustain focus on conversational topics for at least 3 turn-exchanges.",
      "Utilize functional social stories to express complex emotions, request assistance, or prompt game participation.",
      "Sustain consistent appropriate eye gaze and physical proximity during group speech circles.",
      "Practice peer turn-taking behaviors and minimize echolalic vocalizations using adaptive visual boards."
    ],
    homeProgram: "Use visual schedules to map daily routines. Schedule low-stress home playdates with single familiar peers. Reinforce cooperative behaviors with clear token systems.",
    recommendations: "1. Occupational Therapy (OT) referral for sensory integration evaluation.\n2. Implementation of functional communication visual schedule at school.\n3. Home behavioral and communication goals synchronization.",
    frequency: "1 session per week (60 minutes)"
  },
  "Fluency Disorder (Stuttering)": {
    diagnosis: "Fluency Disorder (Stuttering)",
    concerns: "Blocks, repetitions (sound, syllable, or word), prolongations, and secondary physical behaviors (e.g., eye blinking, facial tension) when speaking under fatigue or excitement.",
    findings: "Stuttering Severity Instrument (SSI-4) score matches severe fluency impediment. Core behaviors include silent blocks and initial consonant repetitions (/b-b-baby/) during 15% of spoken syllables. Significant facial muscle tension is present.",
    goals: [
      "Acknowledge and identify moments of stuttering/blocks (stuttering awareness training) with supportive clinicians.",
      "Implement fluency shaping methods (easy onset, prolonged vowels, light articulatory contacts) in controlled loops.",
      "Practice stuttering modification techniques (pull-out, cancellation) to self-correct and relieve physical block tension.",
      "Reduce communicative anxiety and negative attitudes towards speaking across different environments."
    ],
    homeProgram: "Establish a 'slow and relaxed' speaking environment at home. Model slower conversational rates with frequent pauses. Allow full attention and ample time for communication without interruption.",
    recommendations: "1. Therapist coordination with classroom teachers to handle speech anxiety during oral presentations.\n2. Continuous exposure to low-anxiety home conversations.\n3. Follow up on emotional and peer relationships relative to speech fluency.",
    frequency: "1 to 2 sessions per week (45 minutes each)"
  },
  "Speech Delay / Expressive Delay": {
    diagnosis: "Speech and Language Delay (Expressive)",
    concerns: "Limited verbal vocabulary of less than 20 words at age 2. Difficulty requesting basic needs, leading to communication-related tantrums.",
    findings: "Informal observation and language checklist show expressive vocabulary of roughly 15 words, with limited phoneme diversity. Receptive language is stronger—patient follows simple single-step commands and acts rationally.",
    goals: [
      "Enhance core functional communication through a mix of spoken words, keyword signs, and communication boards.",
      "Expand expressive vocabulary up to 75 active functional words (animals, toys, action words).",
      "Combine words into basic two-word phrases to express agency (e.g., 'more milk', 'go outside').",
      "Imitate basic bilabial and alveolar consonant sounds (/m/, /b/, /p/, /t/, /d/) during sensory play routines."
    ],
    homeProgram: "Eliminate background noise/screen-time during learning. Read interactive sound-books daily. Practice communication temptations (e.g., hold favorite snack within sight but out of reach to prompt a word/request).",
    recommendations: "1. Temporary screen-time restriction strictly below 30 minutes daily.\n2. Audiology screen to verify normal hearing status.\n3. Parent coaching program for natural language stimulation.",
    frequency: "1 session per week (45 minutes)"
  }
};
