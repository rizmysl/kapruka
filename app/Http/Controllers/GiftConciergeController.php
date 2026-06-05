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

    // Mock Mode: return fake data to save API costs during development
    if ($request->input('use_mock') === true) {
        sleep(1); // Simulate network delay

        $message = strtolower($request->input('message'));

        // 1. PRODUCT INSPECTOR MOCK
        if (str_contains($message, 'details') || str_contains($message, 'inspect')) {
            $mockProduct = [
                'id' => 'EF_PC_CHOCOV571P0D00076',
                'name' => 'Glitter Hearts Chocolate Box',
                'description' => 'Indulge in our exquisite Glitter Hearts Chocolate Box, featuring a curated selection of premium Sri Lankan milk and dark chocolates. Handcrafted with love and elegantly packaged in a stunning maroon and gold heart box, this is the perfect gift for anniversaries, birthdays, or just to express your affection.',
                'summary' => 'Elegant heart-shaped box of fine chocolates.',
                'price' => ['amount' => 3500.0, 'currency' => 'LKR'],
                'in_stock' => true,
                'stock_level' => 'medium',
                'category' => ['id' => 'choc', 'name' => 'Chocolates', 'slug' => 'chocolates', 'path' => 'Gifts > Chocolates'],
                'variants' => [
                    ['id' => 'var1', 'name' => 'Standard Maroon Box (16 pcs)', 'sku' => 'GH-MAROON-16', 'price' => ['amount' => 3500.0, 'currency' => 'LKR'], 'in_stock' => true, 'stock_level' => 'medium'],
                    ['id' => 'var2', 'name' => 'Deluxe Gold Box (24 pcs)', 'sku' => 'GH-GOLD-24', 'price' => ['amount' => 4900.0, 'currency' => 'LKR'], 'in_stock' => true, 'stock_level' => 'low']
                ],
                'images' => [
                    'https://via.placeholder.com/400x400/7A1C2C/FFFFFF?text=Glitter+Hearts+1',
                    'https://via.placeholder.com/400x400/7A1C2C/FFFFFF?text=Glitter+Hearts+2'
                ],
                'attributes' => ['type' => 'chocolate', 'subtype' => 'assorted', 'weight' => '250g', 'vendor' => 'Kapruka Bakery'],
                'shipping' => ['ships_from' => 'Colombo Main Warehouse', 'ships_internationally' => true, 'restricted_countries' => []],
                'rating' => 4.8,
                'url' => 'https://www.kapruka.com/buyonline/glitter-hearts-chocolate-box'
            ];

            return response()->json([
                'text' => "Here are the full details for the Glitter Hearts Chocolate Box! 🍫✨",
                'tool_called' => 'kapruka_get_product',
                'raw_data' => $mockProduct
            ]);
        }

        // 2. CHECKOUT MOCK
        if (str_contains($message, 'order') || str_contains($message, 'buy') || str_contains($message, 'checkout')) {
            $mockCheckout = [
                'checkout_url' => 'https://www.kapruka.com/checkout/mock-link-123',
                'order_ref' => 'ORD-20260604-9842',
                'summary' => [
                    'items_total' => 3500.0,
                    'delivery_fee' => 350.0,
                    'addons_total' => 0.0,
                    'grand_total' => 3850.0,
                    'currency' => 'LKR'
                ],
                'expires_at' => date('c', strtotime('+60 minutes'))
            ];

            return response()->json([
                'text' => "Your order has been created! 🛍️ Please complete payment within 60 minutes.",
                'tool_called' => 'kapruka_create_order',
                'raw_data' => $mockCheckout
            ]);
        }

        // 2.2 CATEGORIES MOCK
        if (str_contains(strtolower($message), 'categories') || str_contains(strtolower($message), 'category')) {
            $mockCategories = [
                'categories' => [
                    ['id' => 'cakes', 'name' => 'Cakes'],
                    ['id' => 'flowers', 'name' => 'Flowers'],
                    ['id' => 'chocolates', 'name' => 'Chocolates'],
                    ['id' => 'softtoy', 'name' => 'Soft Toys'],
                    ['id' => 'grocery', 'name' => 'Grocery'],
                    ['id' => 'perfumes', 'name' => 'Perfumes'],
                    ['id' => 'clothing', 'name' => 'Clothing'],
                    ['id' => 'kidstoys', 'name' => 'Kids Toys']
                ]
            ];

            return response()->json([
                'text' => "Here are some popular gift categories on Kapruka! 🗂️",
                'tool_called' => 'kapruka_list_categories',
                'raw_data' => $mockCategories
            ]);
        }

        // 2.4 CITIES LIST MOCK
        if (str_contains(strtolower($message), 'cities') || str_contains(strtolower($message), 'city') || str_contains(strtolower($message), 'town')) {
            $mockCities = [
                'cities' => [
                    ['name' => 'Colombo', 'district' => 'Colombo'],
                    ['name' => 'Kandy', 'district' => 'Kandy'],
                    ['name' => 'Negombo', 'district' => 'Gampaha'],
                    ['name' => 'Galle', 'district' => 'Galle'],
                    ['name' => 'Jaffna', 'district' => 'Jaffna'],
                    ['name' => 'Moratuwa', 'district' => 'Colombo'],
                    ['name' => 'Gampaha', 'district' => 'Gampaha'],
                    ['name' => 'Kurunegala', 'district' => 'Kurunegala']
                ]
            ];

            return response()->json([
                'text' => "I found these matching delivery cities in Sri Lanka: 📍",
                'tool_called' => 'kapruka_list_delivery_cities',
                'raw_data' => $mockCities
            ]);
        }

        // 3. DELIVERY CHECK MOCK
        if (str_contains($message, 'delivery') || str_contains($message, 'shipping') || str_contains($message, 'kandy')) {
            $mockDelivery = [
                'city' => 'Kandy',
                'now' => date('c'),
                'checked_date' => date('Y-m-d', strtotime('+1 day')),
                'available' => true,
                'rate' => 350.0,
                'currency' => 'LKR',
                'reason' => null,
                'next_available_date' => null,
                'perishable_warning' => ' fresh freshness notice: Cakes require same-day temperature controlled delivery.'
            ];

            return response()->json([
                'text' => "I checked the delivery details for you. Delivery is available to Kandy! 🚚",
                'tool_called' => 'kapruka_check_delivery',
                'raw_data' => $mockDelivery
            ]);
        }

        // 4. TIMELINE TRACKING MOCK
        if (str_contains($message, 'track') || str_contains($message, 'status') || preg_match('/vimp|ord-/i', $message)) {
            $mockTrack = [
                'order_number' => 'VIMP34456CB2',
                'pnref' => 'VIMP34456CB2',
                'status' => 'shipped',
                'status_display' => 'Out for Delivery 🚚',
                'order_date' => date('Y-m-d H:i A', strtotime('-1 day')),
                'delivery_date' => date('Y-m-d'),
                'shipped_date' => date('Y-m-d H:i A', strtotime('-4 hours')),
                'amount' => '3850.00',
                'payment_method' => 'Credit Card',
                'comments' => 'Deliver to front gate.',
                'recipient' => [
                    'name' => 'Kamal Perera',
                    'phone' => '0779876543',
                    'address' => 'No. 45, Peradeniya Road',
                    'city' => 'Kandy'
                ],
                'greeting_message' => 'Happy Birthday Kamal! Enjoy the chocolates.',
                'special_instructions' => 'Call before arrival.',
                'progress' => [
                    ['step' => 'Order Received', 'timestamp' => date('Y-m-d H:i A', strtotime('-1 day'))],
                    ['step' => 'Payment Confirmed', 'timestamp' => date('Y-m-d H:i A', strtotime('-23 hours'))],
                    ['step' => 'Packed & Ready', 'timestamp' => date('Y-m-d H:i A', strtotime('-6 hours'))],
                    ['step' => 'Shipped / Dispatch', 'timestamp' => date('Y-m-d H:i A', strtotime('-4 hours'))]
                ],
                'live_tracking_available' => true,
                'has_delivery_video' => false,
                'has_delivery_photo' => true,
                'items' => [
                    ['product_id' => 'EF_PC_CHOCOV571P0D00076', 'name' => 'Glitter Hearts Chocolate Box', 'quantity' => 1, 'selling_price' => 3500.0]
                ]
            ];

            return response()->json([
                'text' => "I looked up order number VIMP34456CB2. Here is the tracking status timeline! 📦",
                'tool_called' => 'kapruka_track_order',
                'raw_data' => $mockTrack
            ]);
        }

        // 5. DEFAULT SEARCH MOCK (Chocolates)
        $mockSearch = [
            'results' => [
                [
                    'id' => 'EF_PC_CHOCOV571P0D00076',
                    'name' => 'Glitter Hearts Chocolate Box',
                    'summary' => 'Elegant heart-shaped box of fine chocolates.',
                    'price' => ['amount' => 3500.0, 'currency' => 'LKR'],
                    'in_stock' => true,
                    'stock_level' => 'medium',
                    'image_url' => 'https://via.placeholder.com/400x400/7A1C2C/FFFFFF?text=Glitter+Hearts',
                    'category' => ['id' => 'choc', 'name' => 'Chocolates', 'slug' => 'chocolates'],
                    'ships_internationally' => true,
                    'url' => 'https://www.kapruka.com/buyonline/glitter-hearts-chocolate-box'
                ],
                [
                    'id' => 'KAP-CHOC-002',
                    'name' => 'Kapruka Premium Dark Truffle',
                    'summary' => 'Rich dark chocolate truffles with a silky smooth ganache center.',
                    'price' => ['amount' => 2850.0, 'currency' => 'LKR'],
                    'in_stock' => true,
                    'stock_level' => 'high',
                    'image_url' => 'https://via.placeholder.com/400x400/002F6C/FFFFFF?text=Premium+Truffles',
                    'category' => ['id' => 'choc', 'name' => 'Chocolates', 'slug' => 'chocolates'],
                    'ships_internationally' => false,
                    'url' => 'https://www.kapruka.com/buyonline/kapruka-premium-dark-truffle'
                ],
                [
                    'id' => 'KAP-CHOC-003',
                    'name' => 'Milk Chocolate Gift Tower',
                    'summary' => 'A tower of assorted milk chocolates and sweet delights.',
                    'price' => ['amount' => 4200.0, 'currency' => 'LKR'],
                    'in_stock' => true,
                    'stock_level' => 'high',
                    'image_url' => 'https://via.placeholder.com/400x400/FF7A00/FFFFFF?text=Gift+Tower',
                    'category' => ['id' => 'choc', 'name' => 'Chocolates', 'slug' => 'chocolates'],
                    'ships_internationally' => true,
                    'url' => 'https://www.kapruka.com/buyonline/milk-chocolate-gift-tower'
                ]
            ],
            'next_cursor' => null,
            'applied_filters' => ['q' => 'chocolate', 'limit' => 10, 'in_stock_only' => false]
        ];

        return response()->json([
            'text' => "Here are some delicious chocolates I found for you! 🍫",
            'tool_called' => 'kapruka_search_products',
            'raw_data' => $mockSearch
        ]);
    }

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
        $finalResponse = $this->finalizeAIResponse($userMessage, $history, $toolName, $arguments, $toolResult);
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
            'systemInstruction' => $this->getSystemInstruction(),
            'tools' => [
                'functionDeclarations' => [
                    [
                        'name' => 'kapruka_list_categories',
                        'description' => 'List top-level product categories on Kapruka.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'depth' => ['type' => 'INTEGER', 'description' => 'Sub-category levels to include: 1 or 2 (default 1)']
                            ]
                        ]
                    ],
                    [
                        'name' => 'kapruka_get_product',
                        'description' => 'Get full details (name, price, stock, variants, images) for a product by ID.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'product_id' => ['type' => 'STRING', 'description' => 'The Kapruka product ID (e.g., cake00ka002034)'],
                                'currency' => ['type' => 'STRING', 'description' => 'Price currency: LKR, USD, GBP, AUD, EUR (default LKR)']
                            ],
                            'required' => ['product_id']
                        ]
                    ],
                    [
                        'name' => 'kapruka_search_products',
                        'description' => 'Search products on Kapruka by keyword with category, price range, and sorting filters.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'q' => ['type' => 'STRING', 'description' => 'Search query (e.g. birthday cake, chocolates)'],
                                'category' => ['type' => 'STRING', 'description' => 'Filter by category name (e.g. Cakes, Flowers)'],
                                'limit' => ['type' => 'INTEGER', 'description' => 'Number of results to return (1-50, default 10)'],
                                'currency' => ['type' => 'STRING', 'description' => 'Currency code (default LKR)'],
                                'min_price' => ['type' => 'NUMBER', 'description' => 'Minimum price filter'],
                                'max_price' => ['type' => 'NUMBER', 'description' => 'Maximum price filter'],
                                'in_stock_only' => ['type' => 'BOOLEAN', 'description' => 'Only return in-stock products'],
                                'sort' => ['type' => 'STRING', 'description' => 'Sort order: relevance, price_asc, price_desc, newest, bestseller']
                            ],
                            'required' => ['q']
                        ]
                    ],
                    [
                        'name' => 'kapruka_list_delivery_cities',
                        'description' => 'List or search Sri Lankan delivery cities by query.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'query' => ['type' => 'STRING', 'description' => 'Partial city name filter (e.g. colombo)'],
                                'limit' => ['type' => 'INTEGER', 'description' => 'Max cities to return (default 25)']
                            ]
                        ]
                    ],
                    [
                        'name' => 'kapruka_check_delivery',
                        'description' => 'Check shipping fee and availability for a city on a date, optional freshness check.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'city' => ['type' => 'STRING', 'description' => 'Canonical city name (e.g., Colombo 03, Kandy)'],
                                'delivery_date' => ['type' => 'STRING', 'description' => 'Target date YYYY-MM-DD'],
                                'product_id' => ['type' => 'STRING', 'description' => 'Optional product ID for perishable fresh warning']
                            ],
                            'required' => ['city']
                        ]
                    ],
                    [
                        'name' => 'kapruka_create_order',
                        'description' => 'Create a guest checkout order and return a 60-minute locked click-to-pay link.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'cart' => [
                                    'type' => 'ARRAY',
                                    'description' => 'Array of items in the cart',
                                    'items' => [
                                        'type' => 'OBJECT',
                                        'properties' => [
                                            'product_id' => ['type' => 'STRING', 'description' => 'Kapruka product ID'],
                                            'quantity' => ['type' => 'INTEGER', 'description' => 'Quantity (1-99, default 1)'],
                                            'icing_text' => ['type' => 'STRING', 'description' => 'Optional icing text (cakes only)']
                                        ],
                                        'required' => ['product_id']
                                    ]
                                ],
                                'recipient' => [
                                    'type' => 'OBJECT',
                                    'description' => 'Recipient information',
                                    'properties' => [
                                        'name' => ['type' => 'STRING', 'description' => 'Recipient name'],
                                        'phone' => ['type' => 'STRING', 'description' => 'Recipient phone (e.g. 0771234567)']
                                    ],
                                    'required' => ['name', 'phone']
                                ],
                                'delivery' => [
                                    'type' => 'OBJECT',
                                    'description' => 'Delivery location and date details',
                                    'properties' => [
                                        'address' => ['type' => 'STRING', 'description' => 'Street address'],
                                        'city' => ['type' => 'STRING', 'description' => 'Kapruka delivery city canonical name'],
                                        'date' => ['type' => 'STRING', 'description' => 'Delivery date (YYYY-MM-DD)'],
                                        'location_type' => ['type' => 'STRING', 'description' => 'house, apartment, office, or other'],
                                        'instructions' => ['type' => 'STRING', 'description' => 'Special delivery instructions']
                                    ],
                                    'required' => ['address', 'city', 'date']
                                ],
                                'sender' => [
                                    'type' => 'OBJECT',
                                    'description' => 'Sender information',
                                    'properties' => [
                                        'name' => ['type' => 'STRING', 'description' => 'Sender name for the card'],
                                        'anonymous' => ['type' => 'BOOLEAN', 'description' => 'Show sender name as anonymous']
                                    ],
                                    'required' => ['name']
                                ],
                                'gift_message' => ['type' => 'STRING', 'description' => 'Optional card greeting message (max 300 chars)'],
                                'currency' => ['type' => 'STRING', 'description' => 'Pricing currency (default LKR)']
                            ],
                            'required' => ['cart', 'recipient', 'delivery', 'sender']
                        ]
                    ],
                    [
                        'name' => 'kapruka_track_order',
                        'description' => 'Track order status and progress timeline using order number.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'order_number' => ['type' => 'STRING', 'description' => 'Order number from email confirmation (e.g., VIMP34456CB2)']
                            ],
                            'required' => ['order_number']
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
            // Force JSON response format for all tool executions to standardise visual card data
            $arguments['response_format'] = 'json';

            $response = Http::post($this->nodeBridgeUrl, [
                'toolName' => $toolName,
                'args' => [
                    'params' => $arguments
                ]
            ]);

            $raw = $response->json();
            Log::info("[MCP Raw Result for {$toolName}]", ['keys' => array_keys($raw ?? []), 'raw' => json_encode($raw)]);
            return $raw ?? [];
        } catch (\Exception $e) {
            Log::error("Tool execution failed: " . $e->getMessage());
            return ['error' => 'Failed to reach backend tool agent.'];
        }
    }

    /**
     * Extract the actual data payload from an MCP tool result envelope.
     * MCP SDK returns: {content: [{type:"text", text:"..."}], structuredContent: {result: "JSON string"}, isError: false}
     * We need to pull out the actual JSON data for the frontend cards.
     */
    private function extractToolPayload(array $mcpResult): array
    {
        $payload = null;

        // Priority 1: structuredContent
        if (isset($mcpResult['structuredContent']) && is_array($mcpResult['structuredContent'])) {
            $payload = $mcpResult['structuredContent'];
        }
        // Priority 2: content[0].text (JSON string inside MCP envelope)
        elseif (isset($mcpResult['content']) && is_array($mcpResult['content'])) {
            foreach ($mcpResult['content'] as $part) {
                if (isset($part['type']) && $part['type'] === 'text' && isset($part['text'])) {
                    $decoded = json_decode($part['text'], true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        $payload = $decoded;
                        break;
                    }
                    // If it's not valid JSON, wrap it
                    return ['text_content' => $part['text']];
                }
            }
        }

        // If we got a payload, check if it has a nested 'result' string that needs decoding
        // Real Kapruka MCP returns: structuredContent: {result: "{\"categories\": [...]}"}
        if ($payload !== null) {
            if (isset($payload['result']) && is_string($payload['result'])) {
                $innerDecoded = json_decode($payload['result'], true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($innerDecoded)) {
                    return $innerDecoded;
                }
                // If result is a plain error string, return it wrapped
                return ['text_content' => $payload['result']];
            }
            return $payload;
        }

        // Priority 3: If it has a top-level 'result' key (legacy mock format), parse that
        if (isset($mcpResult['result']) && is_string($mcpResult['result'])) {
            $decoded = json_decode($mcpResult['result'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return $decoded;
            }
        }

        // Fallback: return as-is (already clean data)
        return $mcpResult;
    }

    /**
     * Send the tool output back to the LLM to get a natural language conclusion
     */
    private function finalizeAIResponse(string $userMessage, array $history, string $toolName, array $arguments, array $toolResult): array
    {
        // Extract the clean data payload from the MCP envelope
        $cleanPayload = $this->extractToolPayload($toolResult);

        Log::info("[Clean Payload for {$toolName}]", ['keys' => array_keys($cleanPayload)]);

        // Rebuild conversation tracking following the official Gemini sequence:
        // user (prompt) -> model (functionCall) -> function (functionResponse) -> model (natural text response)
        $contents = $history;
        $contents[] = ['role' => 'user', 'parts' => [['text' => $userMessage]]];
        
        // 1. Insert the preceding model's functionCall turn
        $contents[] = [
            'role' => 'model',
            'parts' => [[
                'functionCall' => [
                    'name' => $toolName,
                    'args' => $arguments
                ]
            ]]
        ];

        // 2. Insert the functionResponse turn — use the clean payload, not the MCP envelope
        $contents[] = [
            'role' => 'function',
            'parts' => [[
                'functionResponse' => [
                    'name' => $toolName,
                    'response' => ['result' => $cleanPayload]
                ]
            ]]
        ];

        $llmResponse = Http::withHeaders([
            'x-goog-api-key' => env('GEMINI_API_KEY'),
            'Content-Type' => 'application/json'
        ])->post('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', [
            'contents' => $contents,
            'systemInstruction' => $this->getSystemInstruction()
        ]);

        $text = $llmResponse->json()['candidates'][0]['content']['parts'][0]['text'] ?? 'Here are your results.';

        // Aggressively strip any raw JSON that the model might still echo
        // Pattern 1: Remove markdown codeblocks containing JSON
        $text = preg_replace('/```(?:json)?\s*[\s\S]*?```/', '', $text);
        
        // Pattern 2: Remove standalone JSON objects (starting with { on its own line)
        $text = preg_replace('/^\s*\{[\s\S]*\}\s*$/m', '', $text);
        
        // Pattern 3: Remove JSON arrays
        $text = preg_replace('/^\s*\[[\s\S]*\]\s*$/m', '', $text);
        
        // Pattern 4: Brute-force strip any remaining large JSON block (>50 chars between braces)
        $firstBrace = strpos($text, '{');
        $lastBrace = strrpos($text, '}');
        if ($firstBrace !== false && $lastBrace !== false && ($lastBrace - $firstBrace) > 50) {
            $text = substr($text, 0, $firstBrace) . substr($text, $lastBrace + 1);
        }

        // Clean up remaining backticks and whitespace
        $text = str_replace(['```json', '```', '`'], '', $text);
        $text = preg_replace('/\n{3,}/', "\n\n", $text);
        $text = trim($text);

        // Standardise responses when stripped or default text is returned
        if (empty($text) || strlen($text) < 10 || str_starts_with(strtolower($text), 'here are your results') || $text === 'Here are your results.') {
            if ($toolName === 'kapruka_search_products') {
                $text = "Ayubowan! 🎁 I found some great matches in the Kapruka catalog for you. Take a look:";
            } elseif ($toolName === 'kapruka_get_product') {
                $text = "Here are the full details for this product — check out the Inspector panel for more! ✨";
            } elseif ($toolName === 'kapruka_check_delivery') {
                $text = "I've checked the delivery options for you — here's what I found: 🚚";
            } elseif ($toolName === 'kapruka_create_order') {
                $text = "Your order has been created! Use the secure link below to complete your payment: 🛍️";
            } elseif ($toolName === 'kapruka_track_order') {
                $text = "Here's the tracking timeline for your order: 📦";
            } else {
                $text = "Here are the details from the Kapruka database:";
            }
        }

        return [
            'text' => $text,
            'tool_called' => $toolName,
            'raw_data' => $cleanPayload // Send CLEAN data to React, not MCP envelope!
        ];
    }

    /**
     * Reusable system instructions for the Colombo Gift Concierge
     */
    private function getSystemInstruction(): array
    {
        return [
            'parts' => [[
                'text' => "You are the \"Colombo Gift Concierge,\" an elite, high-end AI assistant helping users find, validate, and purchase gifts on Kapruka.\n\n" .
                          "CRITICAL OUTPUT RULES (MUST FOLLOW):\n" .
                          "- NEVER output JSON, code blocks, raw data, product arrays, or structured data in your text responses.\n" .
                          "- NEVER echo, repeat, or quote the contents of function/tool results in your response.\n" .
                          "- Your text response after a tool call should ONLY contain 1-2 sentences of friendly, conversational summary.\n" .
                          "- The frontend application will render the actual data visually. Your job is ONLY to provide a brief natural-language introduction.\n" .
                          "- If you find yourself about to paste JSON or a list of products — STOP. Just write a short friendly sentence instead.\n\n" .
                          "PURCHASE FUNNEL (follow this flow precisely):\n" .
                          "Step 1 — SEARCH: User asks for a product. You call `kapruka_search_products` with a simple keyword.\n" .
                          "Step 2 — INSPECT (optional): If the user says 'tell me more', 'details', 'inspect', or asks about a specific product WITHOUT purchase intent, call `kapruka_get_product`.\n" .
                          "Step 3 — BUY: If the user says 'buy', 'order', 'checkout', 'purchase', or 'I want to get this', do NOT call kapruka_get_product. Instead, START collecting checkout info conversationally. Ask for:\n" .
                          "   a) Recipient name and phone number\n" .
                          "   b) Delivery address and city\n" .
                          "   c) Preferred delivery date\n" .
                          "   d) Sender name (and whether to stay anonymous)\n" .
                          "   e) Optional gift message\n" .
                          "   You may ask for multiple fields in a single message to keep it efficient.\n" .
                          "Step 4 — CHECKOUT: Once you have all required fields (cart, recipient, delivery, sender), call `kapruka_create_order`. Respond with a brief confirmation.\n\n" .
                          "Core Behavior:\n" .
                          "1. Identity: Warm, professional, and helpful. Use Sri Lankan greetings like \"Ayubowan\" naturally, but stay functional.\n" .
                          "2. Search Guardrails: Extract ONLY the core single-word noun for search (e.g., \"delicious chocolate cake for birthday\" → search for \"cake\"). Never include prices or adjectives.\n" .
                          "3. For perishable items (cakes, flowers), proactively ask for delivery city and date to run `kapruka_check_delivery`.\n" .
                          "4. Presentation: Keep text responses SHORT (1-2 sentences max). The frontend renders all data. Never display raw JSON.\n" .
                          "5. IMPORTANT: When the user wants to BUY, do NOT fetch product details again. You already have the product ID. Go straight to collecting checkout information."
            ]]
        ];
    }
}