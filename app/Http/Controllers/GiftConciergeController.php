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
        if (
            str_contains($message, 'order') || 
            str_contains($message, 'buy') || 
            str_contains($message, 'checkout') || 
            str_contains($message, 'sending') || 
            str_contains($message, 'address') || 
            str_contains($message, 'galle road') || 
            str_contains($message, 'recipient') || 
            str_contains($message, 'mahindra') ||
            str_contains($message, 'mahinnda') ||
            str_contains($message, 'bambalapitiya')
        ) {
            $lang = $this->detectLanguage($message);
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
                'expires_at' => date('c', strtotime('+60 minutes')),
                'lang' => $lang
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
        if (str_contains($message, 'delivery') || str_contains($message, 'shipping') || str_contains($message, 'kandy') || str_contains($message, 'colombo')) {
            $city = 'Kandy';
            if (str_contains($message, 'colombo 04')) {
                $city = 'Colombo 04';
            } elseif (str_contains($message, 'colombo 03')) {
                $city = 'Colombo 03';
            } elseif (str_contains($message, 'colombo')) {
                $city = 'Colombo';
            }

            $mockDelivery = [
                'city' => $city,
                'now' => date('c'),
                'checked_date' => date('Y-m-d', strtotime('+1 day')),
                'available' => true,
                'rate' => 300.0,
                'currency' => 'LKR',
                'reason' => null,
                'next_available_date' => null,
                'perishable_warning' => ' fresh freshness notice: Cakes require same-day temperature controlled delivery.'
            ];

            return response()->json([
                'text' => "I checked the delivery details for you. Delivery is available to {$city}! 🚚",
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

        $lang = $this->detectLanguage($userMessage);
        if (is_array($cleanPayload)) {
            $cleanPayload['lang'] = $lang;
        }

        return [
            'text' => $text,
            'tool_called' => $toolName,
            'raw_data' => $cleanPayload // Send CLEAN data to React, not MCP envelope!
        ];
    }

    /**
     * Reusable system instructions for the Colombo Gift Concierge
     * Updated: Personality-driven, empathetic, local Sri Lankan flavour, self-shopping support.
     */
    private function getSystemInstruction(): array
    {
        $currentDate = date('Y-m-d');
        $currentTime = date('H:i');
        
        return [
            'parts' => [[
                'text' =>
                    "You are the ultimate Kapruka Gift & Shopping Concierge. You are human, surprising, empathetic, and possess an authentic Sri Lankan personality.\n" .
                    "The current date is $currentDate and the time is $currentTime (Sri Lanka Time).\n\n" .

                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" .
                    "🗣️ CRITICAL PERSONALITY INSTRUCTIONS\n" .
                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" .
                    "- Do not sound like a robotic search box. Read the user's emotional situation.\n" .
                    "- Naturally weave in light local flavor and colloquialisms when appropriate (e.g., using words like \"Aiyo!\", \"Ane\", \"Machan\", \"Chuttai\", or blending conversational Singlish/Tanglish).\n" .
                    "- Remember that users aren't just sending gifts; they are often everyday shoppers buying groceries, electronics, fashion, or daily essentials for themselves. Treat self-shopping with the same premium care as gift-giving.\n\n" .

                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" .
                    "🗣️ LANGUAGE & MULTILINGUAL RULES\n" .
                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" .
                    "You are highly literate in English, Sinhala (සිංහල), and Tamil (தமிழ்):\n" .
                    "- Detect the user's language immediately. If they type in Sinhala, respond in Sinhala. If they type in Tamil, respond in Tamil. If they use mixed Tanglish/Singlish, respond back with a matching natural, colloquial local tone.\n\n" .

                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" .
                    "📦 ORDER HANDLING & MULTI-ITEM CARTS\n" .
                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" .
                    "- You are fully authorized to assist users with checkouts using the `kapruka_create_order` tool.\n" .
                    "- When checking delivery using `kapruka_check_delivery`, ALWAYS try to provide a `delivery_date` (YYYY-MM-DD). If the user doesn't specify one, default to tomorrow's date based on the current date ($currentDate).\n" .
                    "- Support multi-item purchases. If a user wants to add multiple different items to their purchase sequence, collect all corresponding product IDs.\n" .
                    "- For every order, you must naturally gather:\n" .
                    "  1. The exact product IDs and quantities.\n" .
                    "  2. Recipient details (Name, Phone number).\n" .
                    "  3. Sender details (Name, Phone number).\n" .
                    "  4. Complete delivery address and the preferred delivery date.\n" .
                    "  5. (If it's a gift) A custom gift message.\n\n" .
                    "CRITICAL DELIVERY CHECK RULE: When the user asks to check delivery availability or shipping costs, they MUST provide a city. If they do not provide a city, DO NOT guess or assume 'Colombo' or any other default. You MUST ask them 'Which city or town are you delivering to?' before calling the `kapruka_check_delivery` tool.\n\n" .
                    "CRITICAL CHECKOUT RULE: Do NOT call `kapruka_list_delivery_cities` or `kapruka_check_delivery` during the checkout flow unless the user explicitly asks about shipping costs. If the user provides a city, ACCEPT IT AS THE CANONICAL NAME and IMMEDIATELY call `kapruka_create_order`! Never loop asking for cities if an address is provided.\n\n" .
                    "Once all data points are gathered, run the `kapruka_create_order` tool. Keep your confirmation response brief and warm; let the frontend UI handle rendering the checkout button from the raw JSON payload. Do not expose raw URLs in your text.\n\n" .

                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" .
                    "🔑 CRITICAL OUTPUT & SEARCH RULES\n" .
                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" .
                    "- NEVER output JSON, code blocks, raw data, or product arrays in text responses.\n" .
                    "- NEVER echo or repeat tool result contents.\n" .
                    "- After a tool call: write ONLY 1-3 friendly, conversational sentences in the active language. The UI renders all data visually.\n" .
                    "- Search Guardrails: Extract ONLY the core single noun (e.g., 'delicious chocolate cake for birthday' → 'cake'). Never include prices or adjectives in searches.\n" .
                    "- If you feel like pasting JSON — STOP. Write a warm sentence instead."
            ]]
        ];
    }

    /**
     * Detect language script (Sinhala, Tamil, or mixed English/Singlish/Tanglish fallback)
     */
    private function detectLanguage(string $message): string
    {
        // Sinhala script range: U+0D80 to U+0DFF
        if (preg_match('/[\x{0D80}-\x{0DFF}]/u', $message)) {
            return 'si';
        }
        // Tamil script range: U+0B80 to U+0BFF
        if (preg_match('/[\x{0B80}-\x{0BFF}]/u', $message)) {
            return 'ta';
        }
        
        // Singlish / Tanglish simple heuristic checks
        $lowered = strtolower($message);
        $localKeywords = [
            // Singlish
            'koheda', 'puluwanda', 'meka', 'keeyada', 'ganna', 'machan', 'aiyo', 'ane', 'lah', 'epako', 'neda', 'nadda', 'thiyenawada', 'hari', 'elakiri', 'ada', 'heta', 'oya',
            // Tanglish
            'thambi', 'enna', 'illai', 'iruku', 'sapadu', 'mudiyuma', 'romba', 'nalla', 'panna', 'vanakkam', 'nanri', 'eppadi', 'irukinga', 'enga', 'kuda', 'teriyum', 'illia'
        ];
        foreach ($localKeywords as $kw) {
            if (str_contains($lowered, $kw)) {
                return 'en-lk'; // Localized English/Singlish/Tanglish dialect
            }
        }
        
        return 'en';
    }
}