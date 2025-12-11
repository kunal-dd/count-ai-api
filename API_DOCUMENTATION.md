# Restaurant Server API Documentation

## Base URL
`https://count-ai-api.onrender.com`

## Endpoints

### 1. Get Inventory
Retrieves the full list of inventory items.

- **URL**: `/inventory`
- **Method**: `GET`
- **Success Response**:
  - **Code**: 200 OK
  - **Content**: Array of inventory objects.

### 2. Update Inventory Item
Updates the details of a specific inventory item.

- **URL**: `/inventory/:id`
- **Method**: `PUT`
- **URL Params**: `id=[integer]`
- **Data Params** (JSON body):
  - Any field to update, e.g., `{ "price": 12.99, "quantity": 50 }`
- **Success Response**:
  - **Code**: 200 OK
  - **Content**: The updated inventory object.
- **Error Response**:
  - **Code**: 404 Not Found (if item ID does not exist)

### 3. Update Inventory Item by Name
Updates the details of an inventory item using its name (case-insensitive).

- **URL**: `/inventory/name/:name`
- **Method**: `PUT`
- **URL Params**: `name=[string]`
- **Data Params** (JSON body):
  - Any field to update, e.g., `{ "price": 14.99, "quantity": 45 }`
- **Success Response**:
  - **Code**: 200 OK
  - **Content**: The updated inventory object.
- **Error Response**:
  - **Code**: 404 Not Found (if item name does not exist)

### 4. Get Low Stock Items
Retrieves items with quantity less than 10.

- **URL**: `/inventory/low-stock`
- **Method**: `GET`
- **Success Response**:
  - **Code**: 200 OK
  - **Content**: Array of low-stock inventory objects.

### 5. Place Order
Places a new order, updates inventory, and records the order.

- **URL**: `/orders`
- **Method**: `POST`
- **Data Params** (JSON body):
  ```json
  {
    "items": [
      { "name": "Pizza", "quantity": 2 },
      { "id": 3, "quantity": 1 }
    ]
  }
  ```
  *Note: You can provide either `id` or `name` for each item.*
- **Success Response**:
  - **Code**: 201 Created
  - **Content**: The created order object.
- **Error Response**:
  - **Code**: 400 Bad Request (invalid format or insufficient stock)
  - **Code**: 404 Not Found (item ID not found)

---

## Usage with ElevenLabs Server Tool

To allow an ElevenLabs agent to interact with this server, you can use the provided Server Tool definitions.

### Setup

1. **Server URL**: Your API is live at `https://count-ai-api.onrender.com`.

2. **Configure ElevenLabs Agent**:
   - Go to your Agent's configuration in the ElevenLabs dashboard.
   - Look for the **Tools** or **Server Tools** section.
   - Create new tools using the definitions found in `elevenlabs_schema.json`.

### Tool Definitions

The file `elevenlabs_schema.json` contains the JSON schema for the following tools:

- `get_inventory`: Fetches current stock.
- `update_inventory_item`: Updates price or quantity of an item.
- `update_inventory_by_name`: Updates details of an item by name.
- `get_low_stock_items`: Checks for items running low.
- `place_order`: Places an order for multiple items.

When configuring the tool in ElevenLabs:
- **Name**: Use the name from the JSON object (e.g., `get_inventory`).
- **Description**: Use the description provided.
- **API Schema**: Use the parameters schema provided.
- **Endpoint**: Map the tool to the corresponding API endpoint (e.g., `GET https://count-ai-api.onrender.com/inventory`).
