---
title: People
permalink: "/people/"
layout: page
---

### Candidates

{% assign person = site.data.people | sort: 'last_names' %}
<table>
<thead>
  <th></th>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>Party</th>
</thead>
<tbody>
{% for member in person  %}
  <tr>
    <td>
      {% if member.image %}
      <a href="{{ site.url }}/people/{{ member.id }}">
        <img class="table-image" src="{{ member.image }}" alt="A photo of {{ member.full_name }}">
      </a>
      {% endif %}
    </td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td>
      {% if member.election_2020 %}
      <a href="{{ site.url }}/office/{{ member.election_2020.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.election_2020.office }} (2020)</a><br>
      {% endif %}
      {% if member.election_2019 %}
      <a href="{{ site.url }}/office/{{ member.election_2019.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.election_2019.office }} (2019)</a><br>
      {% endif %}
      {% if member.election_2018 %}
      <a href="{{ site.url }}/office/{{ member.election_2018.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.election_2018.office }} (2018)</a><br>
      {% endif %}
      {% if member.election_2017 %}
      <a href="{{ site.url }}/office/{{ member.election_2017.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.election_2017.office }} (2017)</a><br>
      {% endif %}
    </td>
    <td>
      {% if member.election_2020 %}
      <a href="{{ site.url }}/party/{{ member.election_2020.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.election_2020.party }}</a><br>
      {% endif %}
      {% if member.election_2019 %}
      <a href="{{ site.url }}/party/{{ member.election_2019.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.election_2019.party }}</a><br>
      {% endif %}
      {% if member.election_2018 %}
      <a href="{{ site.url }}/party/{{ member.election_2018.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.election_2018.party }}</a><br>
      {% endif %}
      {% if member.election_2017 %}
      <a href="{{ site.url }}/party/{{ member.election_2017.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.election_2017.party }}</a><br>
      {% endif %}
    </td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
