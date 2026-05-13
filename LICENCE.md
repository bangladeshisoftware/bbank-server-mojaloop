# LICENSE

## B Bank Server Project

Copyright © 2025-2026 Bangladeshi Software Ltd.

**Company:** Bangladeshi Software Ltd.
**Website:** https://www.bangladeshisoftware.com
**Headquarters:** Dhaka, Bangladesh
**Contact:** support@bangladeshisoftware.com

---

Bangladeshi Software Ltd. is a pioneering fintech solutions provider in Bangladesh,
specializing in regulatory compliance, inclusive payment ecosystems, and digital
financial infrastructure. This project is part of our Mojaloop implementation
initiative to enable secure, interoperable, and scalable instant payment systems
that foster financial inclusion and sustainable growth in Bangladesh and South Asia.

---

The B Bank Server files are made available by Bangladeshi Software Ltd. under the
Apache License, Version 2.0 (the "License") and you may not use these files except
in compliance with the License.

You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the specific
language governing permissions and limitations under the License.

---

### About This Project

This project implements the **B Bank Server** — the core banking backend that
serves as a DFSP (Digital Financial Service Provider) in the Mojaloop ecosystem.
It is the receiving counterpart to A Bank, enabling seamless interbank payment
transfers through the Mojaloop Switch.

**Key Features:**
- Core Transfer Echo System
- Mojaloop FSPIOP API Compliance
- Interbank Transfer Engine (B Bank ↔ A Bank)
- Account Management
- Transaction Ledger
- Settlement Integration

**Transfer Flow:**
```
A Bank
      ↓
Mojaloop Switch (FSPIOP API)
      ↓
B Bank Server (this project)
      ↓
B Bank Customer
```

**Listed in Mojaloop Service Provider Directory:**
https://mojaloop.io/service-provider-directory/entry/1955/

---

### Third-Party Licenses

This project incorporates components from the Mojaloop Foundation
(https://github.com/mojaloop), which are licensed under the Apache License,
Version 2.0. Copyright © 2020-2025 Mojaloop Foundation.
