<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Exception;

class KaprukaMcpService
{
    /**
     * The URL of our local Node.js Bridge
     */
    protected string $bridgeUrl = 'http://localhost:3000/call-tool';

    /**
     * Executes a tool via the Node bridge.
     * 
     * @param string $toolName e.g., 'kapruka_search_products'
     * @param array $arguments e.g., ['q' => 'cake']
     * @return array
     */
    public function callTool(string $toolName, array $arguments = []): array
    {
        try {
            $response = Http::timeout(10)->post($this->bridgeUrl, [
                'toolName' => $toolName,
                'args'     => $arguments
            ]);

            if ($response->failed()) {
                throw new Exception("Bridge error: " . $response->body());
            }

            return $response->json();
            
        } catch (Exception $e) {
            return [
                'error' => true,
                'message' => $e->getMessage()
            ];
        }
    }

    // Helper methods for the most common hackathon tools:

  public function searchProducts(string $query, int $limit = 10)
{
    return $this->callTool('kapruka_search_products', [
        'params' => [ // <-- Wrapped here
            'q' => $query,
            'limit' => $limit
        ]
    ]);
}

    public function getProductDetails(string $productId)
    {
        return $this->callTool('kapruka_get_product', [
            'product_id' => $productId
        ]);
    }

    public function checkDeliveryQuote(string $city, string $date, string $productId = null)
    {
        return $this->callTool('kapruka_check_delivery', array_filter([
            'city' => $city,
            'delivery_date' => $date,
            'product_id' => $productId
        ]));
    }
}