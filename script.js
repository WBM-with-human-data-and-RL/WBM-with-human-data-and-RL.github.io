const destinations = [
  { note: 'Find a spot beneath the rings. Leave your to-do list on Earth. Watch the light change with absolutely nowhere to be.', stay: 'One long exhale' },
  { note: 'Follow the rust-red horizon. Collect a few imaginary rocks. Make a wrong turn and call it the best part of the trip.', stay: 'A very unhurried weekend' },
  { note: 'Drift into the blue. Let the familiar get a little smaller. Send a mental postcard to someone you wish were here.', stay: 'Until you feel a little lighter' }
];
const cards = [...document.querySelectorAll('.destination')];
let selected = 0;
function selectDestination(index) {
  selected = index;
  cards.forEach((card, i) => {
    card.classList.toggle('active', i === index);
    card.setAttribute('aria-pressed', String(i === index));
  });
  document.querySelector('#trip-note').textContent = destinations[index].note;
  document.querySelector('#trip-time').textContent = `RECOMMENDED STAY: ${destinations[index].stay.toUpperCase()}`;
}
cards.forEach((card, index) => card.addEventListener('click', () => selectDestination(index)));
document.querySelector('#surprise').addEventListener('click', () => {
  selectDestination((selected + 1 + Math.floor(Math.random() * (destinations.length - 1))) % destinations.length);
});
