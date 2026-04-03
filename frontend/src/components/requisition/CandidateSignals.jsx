import { useRef, useEffect } from 'react';

const EDUCATIONAL = ['iit_grad', 'nit_grad', 'iim_grad', 'top_institute'];
const EDUCATIONAL_LABELS = { iit_grad: 'IIT Grad', nit_grad: 'NIT Grad', iim_grad: 'IIM Grad', top_institute: 'Top Institute' };

const COMPANY = ['unicorn_exp', 'top_internet_product', 'top_software_product', 'top_it_services_mnc', 'top_consulting_mnc'];
const COMPANY_LABELS = {
  unicorn_exp: 'Unicorn Exp',
  top_internet_product: 'Top Internet Product',
  top_software_product: 'Top Software Product',
  top_it_services_mnc: 'Top IT Services MNC',
  top_consulting_mnc: 'Top Consulting MNC',
};

function GroupCheckbox({ label, keys, values, onChange }) {
  const ref = useRef(null);
  const checked = keys.every((k) => values[k]);
  const indeterminate = !checked && keys.some((k) => values[k]);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const toggleAll = (e) => {
    keys.forEach((k) => onChange(k, e.target.checked));
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 font-semibold text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" ref={ref} checked={checked} onChange={toggleAll} className="w-4 h-4 accent-blue-600" />
        {label}
      </label>
      <div className="border border-gray-200 rounded-lg p-3 grid grid-cols-2 gap-2 bg-gray-50">
        {keys.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={!!values[k]}
              onChange={(e) => onChange(k, e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            {EDUCATIONAL_LABELS[k] || COMPANY_LABELS[k]}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function CandidateSignals({ values, onChange }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-4 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-6">
        <GroupCheckbox label="Educational Signals" keys={EDUCATIONAL} values={values} onChange={onChange} />
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm text-gray-700">Diversity Signal</span>
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={!!values.female_diversity}
                onChange={(e) => onChange('female_diversity', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Female Diversity
            </label>
          </div>
        </div>
        <GroupCheckbox label="Company Signals" keys={COMPANY} values={values} onChange={onChange} />
      </div>
    </div>
  );
}
