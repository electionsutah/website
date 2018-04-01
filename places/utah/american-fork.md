---
layout: page
title: American Fork
permalink: /places/utah/american-fork/
---

{% assign place = site.data.places.american_fork %}

<section class="info">
  <p><a href="{{ place.wikipedia_url }}">From Wikipedia:</a></p>
  <p class="citation">{{ place.wikipedia_snippet }}</p>
</section>

### 2018 Election

{% include 2018-elections.html %}

### 2018 Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','American Fork' | sort:'name' %}
<table>
<thead>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in county  %}
  <tr>
    <td><a href="{{member.id}}">{{member.first_name}}</a></td>
    <td><a href="{{member.id}}">{{member.last_name}}</a></td>
    <td>{{ member.office }}</td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
