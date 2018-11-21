# Nova Tokenizer


## Installation

Setup can be done by leveraging Docker, or by installing and running the scripts directly. In both cases, 4 services will be brought online:

- Redis: port `6379`
- Mock DataProvider: port `7002`
- Mock Backend: port `7001`
- Tokenizer: port `7001`

### Quick Setup

[Docker](https://www.docker.com/get-started) and [Docker-Compose](https://docs.docker.com/compose/install/) can be used to quickly scaffold the stack. Logs for all services will print in the current terminal window, labelled with the service name.

```sh
docker pull redis:4-alpine
docker pull emcniece/nova-tokenizer:latest
docker-compose up --no-build
```

Proceed to [Intended Operation](#intended-operation).

### Slow Setup

Each component can be run manually in a separate terminal window. Logs will print for each service when API calls are made.

```sh
npm install
npm run dev:redis
npm run dev:dataprovider
npm run dev:backend
npm run dev:tokenizer
```

Services will be running at ports `7000`, `7001`, and `7002`. Proceed to [Intended Operation](#intended-operation).

## Intended Operation

The following 2 steps illustrate the main use case for the tokenizer as a scoped translator for sensitive data. API calls can be made from either the frontend (step 1) or the backend (step 2), and in all operation the backend should never have contact with the sensitive data.

While executing the curl calls, be sure to check the terminal window for logging activity.

### Step 1: Front-end tokenizes a credit card number

In this step the `curl` call represents a front-end form submission sending a new credit card number to Nova's infrastructure. The Tokenizer ingests a number, creates a token, stores both the number and token in Redis, and sends the clean token to the backend.

The response to the initiator is the created token, and is proxied from the backend through the tokenizer.

*Caveat*: credit card numbers must be 16 digits and cleaned of dashes, spaces, and anything other than numbers.

```sh
curl --request POST \
  --url http://localhost:7000/tokenize \
  --header 'content-type: application/json' \
  --header 'password: password' \
  --data '{
  "number": "2345678901234561"
}'

# Response:
# {"token":"45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627"}
```

### Step 2: Backend requests a report using a token

In this step the `curl` call represents a backend request to retrieve a credit report without knowledge of credit card numbers. The backend is triggered at `localhost:7001/getReport` with a token, and forwards this request to the tokenizer. Once the tokenizer receives the token, it retrieves the credit card number from Redis and sends the number to the DataProvider.

The mock DataProvider will randomly return 1 of 3 available reports, each illustrating a unique edge case and each with a different HTTP application type. The tokenizer will then replace all instances of credit card numbers within the report, and send the sanitized report to the backend.

During this trip, sensitive data is stored in the tokenizer and kept away from the backend.

```sh
curl --request POST \
  --url http://localhost:7001/getReport \
  --header 'content-type: application/json' \
  --header 'password: password' \
  --data '{
  "token": "45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627"
}'

# Response 1 (application/xml):
# <credit-report>45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627<credit-report>

# Response 2 (application/text):
# report cardNumber: 45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627 - 45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627

# Response 3 (application/json):
# {report: {cardNumber: "45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627", secondary: "45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627"}}

```

## Testing Intermediaries

Each of the services can be tested directly - these calls will demonstrate some methods for troubleshooting.

#### Tokenizer: wrong frontend/backend password

```sh
curl --request POST \
  --url http://localhost:7000/tokenize \
  --header 'content-type: application/json' \
  --header 'password: WRONGpassword' \
  --data '{
  "number": "2345678901234561"
}'

# 401 - "Invalid password"
```

#### Tokenizer: fetch DataProvider report directly

```sh
curl --request POST \
  --url http://localhost:7000/fetch \
  --header 'content-type: application/json' \
  --header 'password: password' \
  --data '{
  "token": "45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627"
}'

# "{report: {cardNumber: \"45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627\", secondary: \"45154391777cc3f56ab79b86ac2f6a05ab83d990fe24119929b51b8ccfec6627\"}}"
```

#### Backend: Store token

```sh
curl --request POST \
  --url http://localhost:7001/store \
  --header 'content-type: application/json' \
  --header 'password: password' \
  --data '{"token": "abcdef12345"}'

# {"token": "abcdef12345"}
```

#### DataProvider: get report for cc number

```sh
curl --request POST \
  --url http://localhost:7002/getReport \
  --header 'content-type: application/json' \
  --data '{
  "number": "2345678901234561"
}'

# report cardNumber: 2345678901234561 - 2345678901234561
```



## Pitfalls

There are many issues with the existing code, and many things that could be improved.

- Tokenize requests with alternate `Content-Type` headers time out
- Tokenize requests with no body time out
- Redis doesn't currently persist data to disk (needs volume & config)
- Auth middleware is not in the least bit secure
- Backend password shouldn't come from a `.env` file
- `.env` file shouldn't be tracked in version control
- Reports with multiple different credit card numbers all substitue with the same token
- Tokenizer uses a lot of `async/await` which is not performant for long-running API calls



