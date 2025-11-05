import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { type IntakeData } from '@/lib/intakeSchema';
/**
 * Retrive and rerank resource matching logic
 */
// Load environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_CONTENT_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_CONTENT_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface MatchedResource {
  id: string;
  title?: string;
  type?: string;
  org?: string;
  url?: string;
  country?: string;
  audience?: string;
  crisis?: boolean;
  language?: string;
  short_desc?: string;
  reliability_score?: number;
  tags_all?: string[];
  symptoms?: string[];
  similarity: number;
  final_score?: number;
}

export interface MatchOptions {
  limit?: number;
  similarityThreshold?: number;
  filters?: {
    country?: string;
    language?: string;
    crisis?: boolean;
    minReliabilityScore?: number;
  };
}

/**
 * Build semantic query from intake data
 * Emphasizes symptoms and concerns to match against tags_all
 */
export function buildSemanticQuery(intake: IntakeData): string {
  const parts: string[] = [];

  // Primary concern
  parts.push(`Primary concern: ${intake.primary_concern}`);
  // Key symptoms: these will match against tags_all
  if (intake.key_symptoms && intake.key_symptoms.length > 0) {
    parts.push(`Symptoms: ${intake.key_symptoms.join(', ')}`);
  }
  // Sleep quality context
  if (intake.sleep_quality) {
    parts.push(`Sleep quality: ${intake.sleep_quality}`);
    if (intake.sleep_quality === 'poor sleep') {
      parts.push('sleep');
    }
  }
  // User goals
  if (intake.goals) {
    parts.push(`User wants: ${intake.goals}`);
  }
  return parts.join(' | ');
}

/**
 * Calculate semantic tag overlap score between intake and resource
 */
function calculateTagOverlap(intake: IntakeData, resource: MatchedResource): number {
  if (!resource.tags_all || resource.tags_all.length === 0) {
    return 0;
  }

  // Combine all intake text for matching
  const intakeText = [
    intake.primary_concern,
    ...(intake.key_symptoms || []),
    intake.sleep_quality,
    intake.goals
  ].filter(Boolean).join(' ').toLowerCase();

  // Count how many tags appear in the intake
  const matchingTags = resource.tags_all.filter(tag => 
    intakeText.includes(tag.toLowerCase())
  );

  // Return overlap ratio (0 to 1) representing what percentage of the resource's tags matched
  return matchingTags.length / resource.tags_all.length;
}

/**
 * Re-rank resources based on intake context
 */
function reRankResources(resources: MatchedResource[], intake: IntakeData): MatchedResource[] {
  return resources.map(resource => {
    let score = resource.similarity;

    // Boost based on tag overlap
    const tagOverlap = calculateTagOverlap(intake, resource);
    if (tagOverlap > 0) {
      score *= (1 + tagOverlap); // Up to 2x boost for perfect overlap
    }

    // // Boost crisis resources if needed
    // const crisisKeywords = ['suicidal', 'self-harm', 'harm', 'hopeless', 'worthless', 'ending', 'suicide'];
    // const hasCrisisIndicators = 
    //   intake.primary_concern.toLowerCase().split(' ').some(word => crisisKeywords.includes(word)) ||
    //   (intake.key_symptoms || []).some(symptom => 
    //     crisisKeywords.some(crisis => symptom.toLowerCase().includes(crisis))
    //   );
    
    // if (hasCrisisIndicators && resource.crisis) {
    //   score *= 1.5;
    // }

    // Boost highly reliable resources
    if (resource.reliability_score) {
      score *= (1 + resource.reliability_score * 0.1); // Up to 10% boost
    }

    // // Boost if goals match resource type
    // if (intake.goals && resource.type) {
    //   const goalsLower = intake.goals.toLowerCase();
    //   const typeLower = resource.type.toLowerCase();
      
    //   if (goalsLower.includes('professional') && 
    //       (typeLower.includes('therapy') || typeLower.includes('counseling'))) {
    //     score *= 1.2;
    //   }
    //   if (goalsLower.includes('education') && 
    //       (typeLower.includes('education') || typeLower.includes('information'))) {
    //     score *= 1.2;
    //   }
    //   if (goalsLower.includes('support') && 
    //       typeLower.includes('support')) {
    //     score *= 1.2;
    //   }
    // }

    return { ...resource, final_score: score };
  }).sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
}

/**
 * Match resources to intake data using vector similarity search
 */
export async function matchResources(
  intake: IntakeData,
  options: MatchOptions = {}
): Promise<MatchedResource[]> {
  const { 
    limit = 5, //return 5 resources by default
    similarityThreshold = 0.5, //minimum 50% similarity
    //filters 
  } = options;

  try {
    // 1. Build semantic query from intake (searchable text string)
    const queryText = buildSemanticQuery(intake);
    console.log('Query text:', queryText);

    // 2. Generate embedding for the query: convert query text into a vector that represents its semantic meaning
    const { embedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004'),
      value: queryText,
    });

    console.log('Generated query embedding');

    // 3. Search for similar resources using Supabase RPC
          // Supabase compares intake query vector against all resource vectors in the db
          // use pgvector to find the closest matches
    const { data: matches, error } = await supabase.rpc('match_resources_public', {
      query_embedding: embedding, // vector embedding of intake query
      match_threshold: similarityThreshold, // 0.5
      match_count: limit * 3  // Get more for filtering and re-ranking
    });

    if (error) {
      console.error('Error matching resources:', error);
      throw error;
    }

    if (!matches || matches.length === 0) {
      console.log('No matching resources found');
      return [];
    }

    console.log(`Found ${matches.length} potential matches`);
// //  Apply additional filters if provided
//     let filtered: MatchedResource[] = matches;

//     if (filters?.country) {
//       filtered = filtered.filter((r: MatchedResource) => r.country === filters.country);
//     }
//     if (filters?.language) {
//       filtered = filtered.filter((r: MatchedResource) => r.language === filters.language);
//     }
//     if (filters?.crisis !== undefined) {
//       filtered = filtered.filter((r: MatchedResource) => r.crisis === filters.crisis);
//     }
//     if (filters?.minReliabilityScore !== undefined) {
//       filtered = filtered.filter((r: MatchedResource) => 
//         r.reliability_score !== undefined && 
//         r.reliability_score !== null && 
//         r.reliability_score >= filters.minReliabilityScore!
//       );
//     }


    // 5. Re-rank and prioritize (includes tag overlap scoring)
    const ranked = reRankResources(matches, intake);

    // 6. Return top N results
    return ranked.slice(0, limit);

  } catch (error) {
    console.error('Error in matchResources:', error);
    throw error;
  }
}

