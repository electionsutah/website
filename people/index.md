---
title: People
permalink: "/people/"
layout: page
---

{% assign person = site.data.people | sort: 'last_names' %}
<table>
<thead>
  <th></th>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>Party</th>
  <th>City</th>
  <th>County</th>
  <th>Status</th>
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
      {% if member.2020_election %}
      <a href="{{ site.url }}/office/{{ member.2020_election.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.2020_election.office }} (2020)</a><br>
      {% endif %}
      {% if member.2019_election %}
      <a href="{{ site.url }}/office/{{ member.2019_election.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.2019_election.office }} (2019)</a><br>
      {% endif %}
      {% if member.2018_election %}
      <a href="{{ site.url }}/office/{{ member.2018_election.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.2018_election.office }} (2018)</a><br>
      {% endif %}
      {% if member.2017_election %}
      <a href="{{ site.url }}/office/{{ member.2017_election.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.2017_election.office }} (2017)</a><br>
      {% endif %}
    </td>
    <td>
      {% if member.2020_election %}
      <a href="{{ site.url }}/party/{{ member.2020_election.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.2020_election.party }}</a><br>
      {% endif %}
      {% if member.2019_election %}
      <a href="{{ site.url }}/party/{{ member.2019_election.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.2019_election.party }}</a><br>
      {% endif %}
      {% if member.2018_election %}
      <a href="{{ site.url }}/party/{{ member.2018_election.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.2018_election.party }}</a><br>
      {% endif %}
      {% if member.2017_election %}
      <a href="{{ site.url }}/party/{{ member.2017_election.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.2017_election.party }}</a><br>
      {% endif %}
    </td>
    <td>
      {% if member.2020_election %}
      <a href="{{ site.url }}/places/{{ member.2020_election.county | downcase | replace: ' ','-' }}/{{ member.2020_election.city | downcase | replace: ' ','-' }}">{{ member.2020_election.city }}</a><br>
      {% endif %}
      {% if member.2019_election %}
      <a href="{{ site.url }}/places/{{ member.2019_election.county | downcase | replace: ' ','-' }}/{{ member.2019_election.city | downcase | replace: ' ','-' }}">{{ member.2019_election.city }}</a><br>
      {% endif %}
      {% if member.2018_election %}
      <a href="{{ site.url }}/places/{{ member.2018_election.county | downcase | replace: ' ','-' }}/{{ member.2018_election.city | downcase | replace: ' ','-' }}">{{ member.2018_election.city }}</a><br>
      {% endif %}
      {% if member.2017_election %}
      <a href="{{ site.url }}/places/{{ member.2017_election.county | downcase | replace: ' ','-' }}/{{ member.2017_election.city | downcase | replace: ' ','-' }}">{{ member.2017_election.city }}</a><br>
      {% endif %}
    </td>
    <td>
      {% if member.2020_election %}
      <a href="{{ site.url }}/places/{{ member.2020_election.county | downcase | replace: ' ','-' }}/">{{ member.2020_election.county }}</a><br>
      {% endif %}
      {% if member.2019_election %}
      <a href="{{ site.url }}/places/{{ member.2019_election.county | downcase | replace: ' ','-' }}/">{{ member.2019_election.county }}</a><br>
      {% endif %}
      {% if member.2018_election %}
      <a href="{{ site.url }}/places/{{ member.2018_election.county | downcase | replace: ' ','-' }}/">{{ member.2018_election.county }}</a><br>
      {% endif %}
      {% if member.2017_election %}
      <a href="{{ site.url }}/places/{{ member.2017_election.county | downcase | replace: ' ','-' }}/">{{ member.2017_election.county }}</a><br>
      {% endif %}
    </td>
    <td>
      {% if member.2020_election %}
      {{ member.2020_election.candidate_status | capitalize }}<br>
      {% endif %}
      {% if member.2019_election %}
      {{ member.2019_election.candidate_status | capitalize }}<br>
      {% endif %}
      {% if member.2018_election %}
      {{ member.2018_election.candidate_status | capitalize }}<br>
      {% endif %}
      {% if member.2017_election %}
      {{ member.2017_election.candidate_status | capitalize }}<br>
      {% endif %}
    </td>
  </tr>
{% endfor %}
</tbody>
</table>
