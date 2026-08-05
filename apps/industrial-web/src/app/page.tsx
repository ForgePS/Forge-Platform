export default function HomePage() {
  return (
    <div className="row">
      <div className="col-lg-8 mb-4">
        <div className="card">
          <div className="card-body">
            <h4 className="card-title mb-2">Forge Industrial Safety</h4>
            <p className="card-text">
              AWS application foundation with the full Sneat Free admin theme. Business modules stay
              gated until migration phases complete. Firebase remains production source of truth
              under DEC-IND-011 P1.
            </p>
            <ul className="mb-0">
              <li>Product: FORGE_INDUSTRIAL</li>
              <li>Theme: Sneat Free (complete package)</li>
              <li>Production cutover: not authorized</li>
              <li>Scan and QR Links remain distinct journeys</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="col-lg-4 mb-4">
        <div className="card">
          <div className="card-body">
            <h5 className="card-title">Quick tips</h5>
            <p className="mb-0 text-muted">
              Use the left menu for modules. Tenant-scoped feature flags control AWS availability;
              global Industrial flags remain OFF.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
