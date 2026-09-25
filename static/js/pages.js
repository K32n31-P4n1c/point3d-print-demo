// Static demo filtering: no backend or personal-data collection.
const form = document.querySelector('.catalog .filters');
if (form) {
  const query = form.elements.q;
  const category = form.elements.category;
  const cards = [...document.querySelectorAll('.product-card')];
  const params = new URLSearchParams(location.search);
  query.value = params.get('q') || '';
  category.value = params.get('category') || '';
  const normalize = value => value.trim().toLocaleLowerCase();
  function filter(updateUrl = true) {
    let visible = 0;
    for (const card of cards) {
      const match = (!category.value || card.dataset.category === category.value)
        && normalize(card.dataset.search).includes(normalize(query.value));
      card.hidden = !match;
      visible += Number(match);
    }
    document.querySelector('#catalog-empty').hidden = visible !== 0;
    if (updateUrl) {
      const next = new URLSearchParams();
      if (query.value.trim()) next.set('q',query.value.trim());
      if (category.value) next.set('category',category.value);
      history.replaceState(null,'',location.pathname + (next.size ? '?' + next : ''));
    }
  }
  form.addEventListener('submit',event => {event.preventDefault();filter();});
  category.addEventListener('change',() => filter());
  query.addEventListener('input',() => filter());
  window.addEventListener('popstate',() => {
    const next = new URLSearchParams(location.search);
    query.value = next.get('q') || ''; category.value = next.get('category') || ''; filter(false);
  });
  filter(false);
}
