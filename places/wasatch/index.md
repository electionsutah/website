---
title: Wasatch County
permalink: "/places/wasatch/"
layout: page
comments: true
---

<!-- <section class="notice">
  <p>{{ site.data.places.utah_county.wikipedia_snippet }} (<a href="{{ site.data.places.utah_county.wikipedia_url }}"><span>Wikipedia</span></a>)</p>
</section> -->

### 2018 Election

{% include 2018-elections.html %}

#### 2018 Primary Candidates
{% assign county = site.data.2017.primary.candidates | where:'county','Wasatch' | sort: 'last_name' %}
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
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>