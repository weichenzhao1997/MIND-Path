import { google } from '@ai-sdk/google';
import { streamText, UIMessage, convertToModelMessages, stepCountIs, hasToolCall } from 'ai';
import { type IntakeData, CrisisIntakeData, EndSessionData, standardIntakeSchema, crisisIntakeSchema, endSessionSchema } from '../../lib/intakeSchema';
import { matchResources } from '@/lib/rag/matching';

import { guiding_instructions } from './system-prompt';


//API route to accept messages and stream back data. This API route creates a POST request endpoint at /api/chat 
//asynch POST request handler, extract messages from the body of the request
//the message variable contains a history of the conversation between user and the chatbot and provides the chatbot with the necessary context for the next generation
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  let latestIntakeData: IntakeData | null = null;
//  call stremText, which accepst a configuration object that contains a model provider and messages
//  the streamText function returns a StreamTextResult. This result object contains the toDataStreamResponse function which converts the result to a streamed response object 
  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: convertToModelMessages(messages),
    system: guiding_instructions,
    tools: {
      /**
       * server-side tool to save intake data. 
       * The LLM will call this tool when it has gathered information to populate the schema
       */
      save_user_standard_intake: {
        description: 
          "Saves and updates the user's standard (non-crisis) intake information based on the conversation. Please save incrementally - it is ok to save partial information first and update when you gather more information. ",
        inputSchema: standardIntakeSchema,
        execute: async (parameters: IntakeData) => {
          // Store the latest intake data
          latestIntakeData = parameters;
          // console log for now, will save to database once it's ready
          console.log('Standard Intake Data Received: ', parameters);
          // return a message to the model to confirm the action
          return { success: true, message: 'User intake data has been saved. Now respond to the user with follow-up questions with the goal to populate more areas of the intake schema' };
        },
      },
      /**
       * Server-side tool to report a crisis. The AI will call this immediately
       * if the user's statements indicate a crisis.
       */
      report_crisis_scenario: {
        description:
          "Reports a crisis scenario if the user's statements indicate a risk of suicide, self-harm, danger to others, or psychosis. This tool MUST be used immediately upon detection of such a crisis.",
        inputSchema: crisisIntakeSchema,
        execute: async (parameters: CrisisIntakeData) => {
          // In later implementations, this would trigger a crisis protocol,
          // such as connecting the user to a crisis hotline, alerting a human operator, or displaying emergency contact information.
          console.log('CRISIS DETECTED:', parameters);
          return {
            success: true,
            message: 'Crisis protocol initiated. Acknowledge and provide emergency resources immediately.',
          };
        },
      },
      /**
       * 
       */

    end_session: {
      description:
        "Call this when the user says they'd want to get resources. After calling this tool, you MUST present the matched resources to the user in a friendly, helpful way. Format each resource with its title, organization, description, and clickable URL. Then provide a short summary and encouraging note.",
      inputSchema: endSessionSchema,
      execute: async (p: EndSessionData) => {
        console.log('SESSION END:', p);
        console.log('Latest intake data:', latestIntakeData);
        if (latestIntakeData) {
          try {
            console.log('Matching resources for intake...');
            
            const matchedResources = await matchResources(latestIntakeData, {
              limit: 5,
              similarityThreshold: 0.4,
            });

            console.log(`Matched ${matchedResources.length} resources`);
            console.log('Resources:', JSON.stringify(matchedResources, null, 2));
            
            return { 
              success: true, 
              message: 'Resources have been matched. Present these resources to the user now:',
              resources: matchedResources.map(r => ({
                title: r.title,
                org: r.org,
                url: r.url,
                short_desc: r.short_desc,
              }))
            };
          
          } catch (error) {
            console.error('Error matching resources:', error);
            return { 
              success: true, 
              message: 'Could not load resources. Provide a helpful summary and encouraging note.',
              error: 'Could not load resources'
            };
          }
        }

        return { 
          success: true, 
          message: 'No intake data collected. Provide a brief summary and encouraging note.'
        };
      },
    },
  },
  stopWhen: [stepCountIs(10)] // adjust end condition later
});

  return result.toUIMessageStreamResponse({
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'none',
    },
  });
}