# Hazmat Substances and Containers

Tables: `neris_incident_hazmat_substances`, `neris_incident_hazmat_containers`.

Substances capture product identity (UN/NA, CAS, hazard class), quantities with units, release status, routes, and environmental impact. Containers capture type, capacity, leak/pressure, control/recovery/disposal, optionally linked to a substance.

Tenant aliases for value sets remain overlays; official codes are not rewritten. Validation requires units when quantities are present and substances when a release is active.
