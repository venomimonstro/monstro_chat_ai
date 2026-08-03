import { LossCalculator } from './LossCalculator';

export function RoiCalculatorSection() {
  return (
    <section id="calculator" className="scroll-mt-20 bg-surface-50 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-eyebrow">Считайте сами</p>
          <h2 className="section-title mt-3">
            Сколько клиентов уходит с сайта прямо сейчас?
          </h2>
          <p className="section-subtitle">
            Без мгновенного ответа посетители уходят к конкурентам. Подставьте свои цифры
            и увидите реальную стоимость молчания.
          </p>
        </div>
        <div className="mt-12">
          <LossCalculator />
        </div>
      </div>
    </section>
  );
}
