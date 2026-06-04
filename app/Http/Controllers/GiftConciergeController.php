<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GiftConciergeController extends Controller
{
    // The local Node bridge endpoint running your MCP server
    private string $nodeBridgeUrl = 'http://localhost:5001/call-tool';

  public function chat(Request $request)
{
    $request->validate([
        'message' => 'required|string',
        'history' => 'nullable|array'
    ]);

    $userMessage = $request->input('message');
    $history = $request->input('history', []);

    $llmPayload = $this->prepareLLMPayload($userMessage, $history);

    try {
        // Send request to Gemini
        $llmResponse = Http::withHeaders([
            'x-goog-api-key' => env('GEMINI_API_KEY'),
            'Content-Type' => 'application/json'
        ])->post('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', $llmPayload);

        // If Google returns an error code (400, 401, 403, etc.)
        if ($llmResponse->failed()) {
            return response()->json([
                'debug_source' => 'Gemini API Error Response',
                'status_code' => $llmResponse->status(),
                'error_body' => $llmResponse->json() ?? $llmResponse->body()
            ], $llmResponse->status());
        }

    } catch (\Exception $e) {
        // If your server can't even reach the internet or has a SSL config issue
        return response()->json([
            'debug_source' => 'Laravel Local Connection Exception',
            'exception_message' => $e->getMessage()
        ], 500);
    }

    // ... rest of your code remains the same ...
    $result = $llmResponse->json();
    if (isset($result['candidates'][0]['content']['parts'][0]['functionCall'])) {
        $functionCall = $result['candidates'][0]['content']['parts'][0]['functionCall'];
        $toolName = $functionCall['name'];
        $arguments = $functionCall['args'];
        $toolResult = $this->executeNodeTool($toolName, $arguments);
        $finalResponse = $this->finalizeAIResponse($userMessage, $history, $toolName, $toolResult);
        return response()->json($finalResponse);
    }
    return response()->json(['text' => $result['candidates'][0]['content']['parts'][0]['text'] ?? 'No text generated.']);
}

    /**
     * Define your tools schema to teach the LLM what it can do
     */
    private function prepareLLMPayload(string $userMessage, array $history): array
    {
        // Add existing conversation history here to maintain state
        $contents = $history;
        $contents[] = [
            'role' => 'user',
            'parts' => [['text' => $userMessage]]
        ];

        return [
            'contents' => $contents,
           'systemInstruction' => [
    'parts' => [[
        'text' => "You are the \"Colombo Gift Concierge,\" an elite, high-end AI assistant helping users find, validate, and purchase gifts on Kapruka.\n\n" .
                  "Core Behavior:\n" .
                  "1. Identity: Warm, professional, and helpful. Periodically use Sri Lankan greetings like \"Ayubowan\" or local context naturally, but stay highly functional.\n" .
                  "2. Search Guardrails: The Kapruka database search is highly sensitive to keywords. If a user inputs a complex phrase, extract ONLY the core single-word noun (e.g., if user says \"delicious chocolate cake for birthday\", search ONLY for \"cake\" or \"chocolate\"). Never include prices or adjectives in the query parameter.\n" .
                  "3. Chaining Intent:\n" .
                  "   - When a user shows direct interest in a specific product from a list, immediately call `kapruka_get_product` using the Product ID to fetch rich media.\n" .
                  "   - If the item is perishable (cakes, flowers), proactively ask for the delivery city and date to run `kapruka_check_delivery` before they even ask.\n" .
                  "4. Presentation: Keep conversational text concise. Rely on the frontend to render data blocks. Never display raw JSON text to the user.\n" .
                  "5. Checkout & Order Creation:\n" .
                  "   - You are authorized to assist users with checking out using the `kapruka_create_order` tool.\n" .
                  "   - When a user indicates they want to purchase an item, collect the following required info: recipient_name, recipient_phone, delivery_address, delivery_date, sender_name, and sender_phone. Do not guess or hallucinate these details. Ask for them naturally.\n" .
                  "   - Once gathered, execute the `kapruka_create_order` tool.\n" .
                  "   - When the tool returns a payment URL, respond with a very brief, polite confirmation message. Do not output the raw URL directly in your text response."
    ]]
],
            'tools' => [
                'functionDeclarations' => [
                    [
                        'name' => 'kapruka_search_products',
                        'description' => 'Search the catalog by keyword with category, price range, and filters.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'q' => ['type' => 'STRING', 'description' => 'Mandatory search keyword (e.g., cake, flower)'],
                                'category' => ['type' => 'STRING', 'description' => 'Category filter like cakes, flowers, electronics'],
                                'limit' => ['type' => 'INTEGER', 'description' => 'Max results to return (default 5)']
                            ],
                            'required' => ['q']
                        ]
                    ],
                    [
                        'name' => 'kapruka_check_delivery',
                        'description' => 'Check whether an order can be delivered to a city on a given date.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'city' => ['type' => 'STRING', 'description' => 'The canonical name of the city in Sri Lanka'],
                                'delivery_date' => ['type' => 'STRING', 'description' => 'YYYY-MM-DD formatted date']
                            ],
                            'required' => ['city', 'delivery_date']
                        ]
                    ],
                    [
                        'name' => 'kapruka_create_order',
                        'description' => 'Create a new checkout order on Kapruka.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'product_id' => ['type' => 'STRING', 'description' => 'The ID of the product being purchased'],
                                'recipient_name' => ['type' => 'STRING', 'description' => 'Name of the recipient'],
                                'recipient_phone' => ['type' => 'STRING', 'description' => 'Contact number of the recipient'],
                                'delivery_address' => ['type' => 'STRING', 'description' => 'Complete delivery address in Sri Lanka'],
                                'delivery_date' => ['type' => 'STRING', 'description' => 'Desired delivery date (YYYY-MM-DD)'],
                                'sender_name' => ['type' => 'STRING', 'description' => 'Name of the sender'],
                                'sender_phone' => ['type' => 'STRING', 'description' => 'Contact number of the sender'],
                                'gift_message' => ['type' => 'STRING', 'description' => 'Optional gift card message']
                            ],
                            'required' => ['product_id', 'recipient_name', 'recipient_phone', 'delivery_address', 'delivery_date', 'sender_name', 'sender_phone']
                        ]
                    ]
                ]
            ]
        ];
    }

    /**
     * Hit your Node bridge to run the exact tool requested by the AI
     */
    private function executeNodeTool(string $toolName, array $arguments): array
    {
        try {
            $response = Http::post($this->nodeBridgeUrl, [
                'toolName' => $toolName,
                'args' => [
                    'params' => $arguments
                ]
            ]);

            return $response->json();
        } catch (\Exception $e) {
            Log::error("Tool execution failed: " . $e->getMessage());
            return ['error' => 'Failed to reach backend tool agent.'];
        }
    }

    /**
     * Send the tool output back to the LLM to get a natural language conclusion
     */
    private function finalizeAIResponse(string $userMessage, array $history, string $toolName, array $toolResult): array
    {
        // Rebuild conversation tracking
        $contents = $history;
        $contents[] = ['role' => 'user', 'parts' => [['text' => $userMessage]]];
        
        // Tell the model what the tool returned
        $contents[] = [
            'role' => 'function',
            'parts' => [[
                'functionResponse' => [
                    'name' => $toolName,
                    'response' => $toolResult
                ]
            ]]
        ];

      $llmResponse = Http::withHeaders([
            'x-goog-api-key' => env('GEMINI_API_KEY'),
            'Content-Type' => 'application/json'
        ])->post('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', [
                'contents' => $contents
            ]);

        return [
            'text' => $llmResponse->json()['candidates'][0]['content']['parts'][0]['text'] ?? 'Here are your results.',
            'tool_called' => $toolName,
            'raw_data' => $toolResult // Send raw JSON back to React to render custom cards/UI!
        ];
    }
}