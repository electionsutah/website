---
title: Utah Democratic Party
permalink: "/party/democratic"
layout: page
comments: true
---

### 2020 Elections

{% include 2020-elections.html %}

#### 2020 Presidential Primary Candidates

{% assign people = site.data.people | where_exp: "someone", "someone.election_2020.office == 'U.S. President' and someone.election_2020.party == 'Democratic'" | sort: "last_names" %}

<table>
<thead>
  <th></th>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>Party</th>
</thead>
<tbody>
{% for member in people  %}
  <tr>
    <td>
      {% if member.image %}
      <a href="{{ site.url }}/people/{{ member.id }}">
        <img class="table-image" src="{{ member.image }}" alt="{{ member.full_name }}">
      </a>
      {% endif %}
    </td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.election_2020.office | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.election_2020.office }}</a></td>
    <td><a href="{{ site.url }}/party/{{ member.election_2020.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.election_2020.party }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
<br>

### 2018 Election

#### 2018 Primary Candidates
{% assign office = site.data.2018.primary.candidates | where:'party','Democratic' | sort:'last_name' %}
<table>
<thead>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in office  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_name }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_name }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>